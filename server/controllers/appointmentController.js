// Appointments for students (book, view, cancel) and faculty (view, answer requests).
// Administrators have their own system-wide view in adminController.
const pool = require('../db');
const withTransaction = require('../utils/transaction');
const httpError = require('../utils/httpError');
const { nowParts, weekdayOf, sqlLocalDate, sqlLocalTime, sqlMoment } = require('../utils/campusTime');
const { blockContainsSlot } = require('../utils/slots');

const reference = (id) => 'APT-' + String(id).padStart(4, '0');

// Which status each role may move an appointment to, from its current status.
const TRANSITIONS = {
    student: { pending: ['cancelled'], approved: ['cancelled'] },
    staff: { pending: ['approved', 'rejected'], approved: ['cancelled', 'completed'] },
};

const select = () => `
    SELECT a.appointment_id, a.status, a.reason, a.created_at,
           ${sqlLocalDate('a.appointment_date')} AS date, ${sqlLocalTime('a.appointment_date')} AS time,
           s.user_id AS student_id, s.full_name AS student_name,
           f.user_id AS staff_id,   f.full_name AS staff_name,
           sv.service_id, sv.service_name
    FROM appointments a
    JOIN users s         ON s.user_id = a.student_id
    JOIN availability av ON av.availability_id = a.availability_id
    JOIN users f         ON f.user_id = av.staff_id
    JOIN services sv     ON sv.service_id = av.service_id`;

const toAppointment = (r, history = []) => ({
    id: r.appointment_id,
    reference: reference(r.appointment_id),
    status: r.status,
    reason: r.reason,
    date: r.date,   // campus-local 'YYYY-MM-DD'
    time: r.time,   // campus-local 'HH:MM'
    created_at: r.created_at,
    student: { id: r.student_id, name: r.student_name },
    staff: { id: r.staff_id, name: r.staff_name },
    service: { id: r.service_id, name: r.service_name },
    history,
});

async function historyFor(ids) {
    const map = new Map(ids.map((id) => [id, []]));
    if (!ids.length) return map;
    const { rows } = await pool.query(
        `SELECT h.history_id, h.appointment_id, h.new_status, h.changed_at, u.full_name AS by_name, u.role AS by_role
         FROM appointment_history h LEFT JOIN users u ON u.user_id = h.changed_by
         WHERE h.appointment_id = ANY($1::int[]) ORDER BY h.changed_at, h.history_id`,
        [ids]
    );
    rows.forEach((h) => map.get(h.appointment_id).push({
        id: h.history_id, status: h.new_status, at: h.changed_at, by: h.by_name ? `${h.by_name} (${h.by_role})` : 'System',
    }));
    return map;
}

// The signed-in student's own appointments, or the signed-in faculty member's.
async function list(req, res) {
    const column = req.user.role === 'student' ? 'a.student_id' : 'av.staff_id';
    const { rows } = await pool.query(
        `${select()} WHERE ${column} = $1 ORDER BY a.appointment_date DESC, a.appointment_id DESC LIMIT 1000`,
        [req.user.user_id]
    );
    const history = await historyFor(rows.map((r) => r.appointment_id));
    res.json({ items: rows.map((r) => toAppointment(r, history.get(r.appointment_id))) });
}

async function load(id) {
    const { rows } = await pool.query(`${select()} WHERE a.appointment_id = $1`, [id]);
    const history = await historyFor([id]);
    return toAppointment(rows[0], history.get(id));
}

async function book(req, res) {
    const staffId = Number(req.body.staff_id);
    const serviceId = Number(req.body.service_id);
    const { date, time } = req.body;
    const reason = (req.body.reason || '').trim() || null;
    const now = nowParts();
    if (date < now.date || (date === now.date && time <= now.time)) throw httpError(400, 'That time has already passed. Pick a later slot.');

    let id;
    try {
        id = await withTransaction(async (client) => {
            // Serialise bookings for this faculty member so two students cannot take the same slot at once.
            const staff = await client.query(`SELECT user_id FROM users WHERE user_id = $1 AND role = 'staff' AND is_active FOR UPDATE`, [staffId]);
            if (!staff.rows[0]) throw httpError(404, 'That faculty member is not available.');

            const blocks = await client.query(
                `SELECT availability_id, weekday, to_char(start_clock, 'HH24:MI') AS start, to_char(end_clock, 'HH24:MI') AS end
                 FROM availability av
                 JOIN services s ON s.service_id = av.service_id AND s.is_active
                 WHERE av.staff_id = $1 AND av.service_id = $2 AND av.is_available`,
                [staffId, serviceId]
            );
            const block = blocks.rows.find((b) => blockContainsSlot(b, weekdayOf(date), time));
            if (!block) throw httpError(400, 'That time is not offered for this service. Pick another slot.');

            const clash = await client.query(
                `SELECT 1 FROM appointments a JOIN availability av ON av.availability_id = a.availability_id
                 WHERE av.staff_id = $1 AND a.appointment_date = ${sqlMoment('$2', '$3')} AND a.status IN ('pending', 'approved') LIMIT 1`,
                [staffId, date, time]
            );
            if (clash.rows[0]) throw httpError(409, 'That slot was just taken. Pick another time.');

            const double = await client.query(
                `SELECT 1 FROM appointments WHERE student_id = $1 AND appointment_date = ${sqlMoment('$2', '$3')} AND status IN ('pending', 'approved') LIMIT 1`,
                [req.user.user_id, date, time]
            );
            if (double.rows[0]) throw httpError(409, 'You already have an appointment at that time.');

            const created = await client.query(
                `INSERT INTO appointments (student_id, availability_id, appointment_date, reason)
                 VALUES ($1, $2, ${sqlMoment('$3', '$4')}, $5) RETURNING appointment_id`,
                [req.user.user_id, block.availability_id, date, time, reason]
            );
            await client.query(
                `INSERT INTO appointment_history (appointment_id, changed_by, old_status, new_status) VALUES ($1, $2, NULL, 'pending')`,
                [created.rows[0].appointment_id, req.user.user_id]
            );
            return created.rows[0].appointment_id;
        });
    } catch (err) {
        if (err.code === '23505') throw httpError(409, 'That slot was just taken. Pick another time.');
        throw err;
    }
    res.status(201).json({ appointment: await load(id) });
}

async function changeStatus(req, res) {
    const id = Number(req.params.id);
    const { status: next, notes } = req.body;
    const role = req.user.role;

    await withTransaction(async (client) => {
        const found = await client.query(
            `SELECT a.status, a.student_id, av.staff_id
             FROM appointments a JOIN availability av ON av.availability_id = a.availability_id
             WHERE a.appointment_id = $1 FOR UPDATE OF a`,
            [id]
        );
        const appt = found.rows[0];
        // Someone else's appointment looks the same as one that does not exist.
        const mine = appt && (role === 'student' ? appt.student_id === req.user.user_id : appt.staff_id === req.user.user_id);
        if (!mine) throw httpError(404, 'Appointment not found.');

        if (!((TRANSITIONS[role][appt.status]) || []).includes(next)) {
            throw httpError(409, `A ${appt.status} appointment cannot be changed to ${next}.`);
        }

        const isReview = next === 'approved' || next === 'rejected';
        await client.query(
            `UPDATE appointments
             SET status = $2,
                 reviewed_by = CASE WHEN $4::boolean THEN $3::int ELSE reviewed_by END,
                 reviewed_at = CASE WHEN $4::boolean THEN CURRENT_TIMESTAMP ELSE reviewed_at END
             WHERE appointment_id = $1`,
            [id, next, req.user.user_id, isReview]
        );
        await client.query(
            `INSERT INTO appointment_history (appointment_id, changed_by, old_status, new_status, notes) VALUES ($1, $2, $3, $4, $5)`,
            [id, req.user.user_id, appt.status, next, notes || null]
        );
    });
    res.json({ appointment: await load(id) });
}

module.exports = { list, book, changeStatus, TRANSITIONS };
