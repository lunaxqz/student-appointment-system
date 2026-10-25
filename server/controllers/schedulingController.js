// Services, faculty directory, bookable time slots, and weekly availability.
// All values reach SQL through $1, $2 ... parameters.
const pool = require('../db');
const withTransaction = require('../utils/transaction');
const httpError = require('../utils/httpError');
const { SLOT_MINUTES, timeZone, nowParts, isDate, addDays, toMinutes, sqlLocalDate, sqlLocalTime } = require('../utils/campusTime');
const { slotsForRange } = require('../utils/slots');

const SLOT_WINDOW_DAYS = 14; // how far ahead "next available" looks
const MAX_SLOT_DAYS = 60;

const toService = (r) => ({ id: r.service_id, name: r.service_name, description: r.description, facultyCount: r.faculty_count });
const toBlock = (r) => ({
    id: r.availability_id, staff_id: r.staff_id, service_id: r.service_id, service_name: r.service_name,
    weekday: r.weekday, start: r.start, end: r.end,
});

const BLOCK_SELECT = `
    SELECT av.availability_id, av.staff_id, av.service_id, sv.service_name, av.weekday,
           to_char(av.start_clock, 'HH24:MI') AS start, to_char(av.end_clock, 'HH24:MI') AS end
    FROM availability av
    JOIN services sv ON sv.service_id = av.service_id`;

// Pending and approved appointments hold their slot. Returns Map(staffId -> Set('YYYY-MM-DD HH:MM')).
async function takenSlots(staffIds, fromDate) {
    const { rows } = await pool.query(
        `SELECT av.staff_id, ${sqlLocalDate('a.appointment_date')} AS d, ${sqlLocalTime('a.appointment_date')} AS t
         FROM appointments a JOIN availability av ON av.availability_id = a.availability_id
         WHERE av.staff_id = ANY($1::int[]) AND a.status IN ('pending', 'approved')
           AND a.appointment_date >= ((($2::date)::timestamp AT TIME ZONE '${timeZone()}') - interval '1 day')`,
        [staffIds, fromDate]
    );
    const map = new Map(staffIds.map((id) => [id, new Set()]));
    rows.forEach((r) => map.get(r.staff_id).add(`${r.d} ${r.t}`));
    return map;
}

// ---------- services ----------

async function listServices(req, res) {
    const { rows } = await pool.query(
        `SELECT s.service_id, s.service_name, s.description,
                (SELECT COUNT(*)::int FROM staff_services ss JOIN users u ON u.user_id = ss.staff_id
                 WHERE ss.service_id = s.service_id AND u.role = 'staff' AND u.is_active) AS faculty_count
         FROM services s WHERE s.is_active ORDER BY s.service_name`
    );
    res.json({ items: rows.map(toService) });
}

// ---------- faculty directory ----------

async function listFaculty(req, res) {
    const params = [];
    let serviceFilter = '';
    if (req.query.service) {
        params.push(Number(req.query.service));
        serviceFilter = `AND EXISTS (SELECT 1 FROM staff_services x WHERE x.staff_id = u.user_id AND x.service_id = $${params.length})`;
    }
    const { rows } = await pool.query(
        `SELECT u.user_id, u.full_name, u.title, u.dept, u.bio,
                COALESCE((SELECT array_agg(ss.service_id ORDER BY ss.service_id) FROM staff_services ss
                          JOIN services s ON s.service_id = ss.service_id AND s.is_active
                          WHERE ss.staff_id = u.user_id), '{}') AS service_ids,
                COALESCE((SELECT array_agg(DISTINCT av.weekday ORDER BY av.weekday) FROM availability av
                          WHERE av.staff_id = u.user_id AND av.is_available), '{}') AS weekdays
         FROM users u
         WHERE u.role = 'staff' AND u.is_active ${serviceFilter}
         ORDER BY u.full_name`,
        params
    );

    const staffIds = rows.map((r) => r.user_id);
    const now = nowParts();
    let blocksByStaff = new Map();
    let taken = new Map();
    if (staffIds.length) {
        const blocks = await pool.query(
            `SELECT staff_id, weekday, to_char(start_clock, 'HH24:MI') AS start, to_char(end_clock, 'HH24:MI') AS end
             FROM availability WHERE staff_id = ANY($1::int[]) AND is_available`,
            [staffIds]
        );
        blocks.rows.forEach((b) => { if (!blocksByStaff.has(b.staff_id)) blocksByStaff.set(b.staff_id, []); blocksByStaff.get(b.staff_id).push(b); });
        taken = await takenSlots(staffIds, now.date);
    }

    const items = rows.map((r) => {
        const days = slotsForRange({ blocks: blocksByStaff.get(r.user_id) || [], taken: taken.get(r.user_id) || new Set(), from: now.date, days: SLOT_WINDOW_DAYS, now });
        let next = null;
        for (const day of days) {
            const open = day.slots.find((s) => !s.busy);
            if (open) { next = { date: day.date, time: open.time }; break; }
        }
        return { id: r.user_id, name: r.full_name, title: r.title, dept: r.dept, bio: r.bio, service_ids: r.service_ids, weekdays: r.weekdays, next_open: next };
    });
    res.json({ items });
}

// Bookable slots for one faculty member and service, day by day.
async function listSlots(req, res) {
    const staffId = Number(req.params.id);
    const days = Math.min(MAX_SLOT_DAYS, Math.max(1, parseInt(req.query.days, 10) || SLOT_WINDOW_DAYS));
    const now = nowParts();

    const staff = await pool.query(`SELECT user_id FROM users WHERE user_id = $1 AND role = 'staff' AND is_active`, [staffId]);
    if (!staff.rows[0]) throw httpError(404, 'Faculty member not found.');

    const params = [staffId];
    let serviceFilter = '';
    if (req.query.service) { params.push(Number(req.query.service)); serviceFilter = `AND service_id = $${params.length}`; }
    const blocks = await pool.query(
        `SELECT weekday, to_char(start_clock, 'HH24:MI') AS start, to_char(end_clock, 'HH24:MI') AS end
         FROM availability WHERE staff_id = $1 AND is_available ${serviceFilter}`,
        params
    );
    const taken = await takenSlots([staffId], now.date);
    res.json({ days: slotsForRange({ blocks: blocks.rows, taken: taken.get(staffId), from: now.date, days, now }) });
}

// ---------- one person's weekly schedule (the faculty member, or an administrator) ----------

function assertCanManage(req, staffId) {
    if (req.user.role !== 'admin' && req.user.user_id !== staffId) throw httpError(403, 'You do not have permission to do that.');
}

async function getSchedule(req, res) {
    const staffId = Number(req.params.id);
    assertCanManage(req, staffId);
    const { from, to } = req.query;
    if (!isDate(from) || !isDate(to) || to < from || to > addDays(from, 31)) throw httpError(400, 'Provide from and to dates (YYYY-MM-DD), at most 31 days apart.');

    const staff = await pool.query(`SELECT user_id FROM users WHERE user_id = $1 AND role = 'staff'`, [staffId]);
    if (!staff.rows[0]) throw httpError(404, 'Faculty member not found.');

    const [blocks, services, appts] = await Promise.all([
        pool.query(`${BLOCK_SELECT} WHERE av.staff_id = $1 AND av.is_available ORDER BY av.weekday, av.start_clock`, [staffId]),
        pool.query(
            `SELECT s.service_id, s.service_name FROM staff_services ss JOIN services s ON s.service_id = ss.service_id AND s.is_active
             WHERE ss.staff_id = $1 ORDER BY s.service_name`, [staffId]
        ),
        pool.query(
            `SELECT a.appointment_id, a.status, ${sqlLocalDate('a.appointment_date')} AS date, ${sqlLocalTime('a.appointment_date')} AS time,
                    st.user_id AS student_id, st.full_name AS student_name, sv.service_id, sv.service_name
             FROM appointments a
             JOIN availability av ON av.availability_id = a.availability_id
             JOIN users st ON st.user_id = a.student_id
             JOIN services sv ON sv.service_id = av.service_id
             WHERE av.staff_id = $1 AND a.status IN ('pending', 'approved', 'completed')
               AND ${sqlLocalDate('a.appointment_date')} BETWEEN $2 AND $3
             ORDER BY a.appointment_date`,
            [staffId, from, to]
        ),
    ]);

    res.json({
        blocks: blocks.rows.map(toBlock),
        services: services.rows.map((r) => ({ id: r.service_id, name: r.service_name })),
        appointments: appts.rows.map((r) => ({
            id: r.appointment_id, status: r.status, date: r.date, time: r.time,
            student: { id: r.student_id, name: r.student_name }, service: { id: r.service_id, name: r.service_name },
        })),
    });
}

// ---------- availability blocks ----------

async function addBlock(req, res) {
    const { service_id, weekday, start, end } = req.body;
    const staffId = req.user.role === 'admin' ? Number(req.body.staff_id) : req.user.user_id;
    if (req.user.role === 'admin' && !Number.isInteger(staffId)) throw httpError(400, 'Choose a faculty member.');
    if (req.user.role !== 'admin' && req.body.staff_id !== undefined && Number(req.body.staff_id) !== staffId) {
        throw httpError(403, 'You can only change your own availability.');
    }
    if (toMinutes(end) - toMinutes(start) < SLOT_MINUTES) throw httpError(400, 'End time must be at least 30 minutes after the start time.');

    const block = await withTransaction(async (client) => {
        // Locking the person's row makes two simultaneous "add block" requests take turns, so overlap checks stay correct.
        const staff = await client.query(`SELECT user_id FROM users WHERE user_id = $1 AND role = 'staff' FOR UPDATE`, [staffId]);
        if (!staff.rows[0]) throw httpError(404, 'Faculty member not found.');

        const offers = await client.query(
            `SELECT 1 FROM staff_services ss JOIN services s ON s.service_id = ss.service_id AND s.is_active
             WHERE ss.staff_id = $1 AND ss.service_id = $2`, [staffId, service_id]
        );
        if (!offers.rows[0]) throw httpError(400, 'This faculty member does not offer that service. Assign it under Manage Staff first.');

        const overlap = await client.query(
            `SELECT 1 FROM availability
             WHERE staff_id = $1 AND weekday = $2 AND is_available AND start_clock < $4::time AND end_clock > $3::time LIMIT 1`,
            [staffId, weekday, start, end]
        );
        if (overlap.rows[0]) throw httpError(409, 'This overlaps an existing block.');

        const inserted = await client.query(
            `INSERT INTO availability (staff_id, service_id, weekday, start_clock, end_clock) VALUES ($1, $2, $3, $4::time, $5::time)
             RETURNING availability_id`,
            [staffId, service_id, weekday, start, end]
        );
        const { rows } = await client.query(`${BLOCK_SELECT} WHERE av.availability_id = $1`, [inserted.rows[0].availability_id]);
        return rows[0];
    });
    res.status(201).json({ block: toBlock(block) });
}

async function removeBlock(req, res) {
    const id = Number(req.params.id);
    await withTransaction(async (client) => {
        const found = await client.query('SELECT staff_id FROM availability WHERE availability_id = $1 FOR UPDATE', [id]);
        if (!found.rows[0]) throw httpError(404, 'Availability block not found.');
        assertCanManage(req, found.rows[0].staff_id);

        // A block that already has appointments is switched off so their history stays intact; otherwise it is deleted.
        const used = await client.query('SELECT 1 FROM appointments WHERE availability_id = $1 LIMIT 1', [id]);
        if (used.rows[0]) await client.query('UPDATE availability SET is_available = FALSE WHERE availability_id = $1', [id]);
        else await client.query('DELETE FROM availability WHERE availability_id = $1', [id]);
    });
    res.status(204).end();
}

module.exports = { listServices, listFaculty, listSlots, getSchedule, addBlock, removeBlock };
