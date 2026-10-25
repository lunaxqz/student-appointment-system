// Administration: dashboard numbers, user management and system-wide appointment monitoring.
// All values reach SQL through $1, $2 ... parameters; user input is never joined into query text.
const bcrypt = require('bcryptjs');
const pool = require('../db');
const withTransaction = require('../utils/transaction');
const httpError = require('../utils/httpError');

const STATUSES = ['pending', 'approved', 'rejected', 'cancelled', 'completed'];
// Which status an appointment may move to from its current one.
const TRANSITIONS = { pending: ['approved', 'rejected'], approved: ['cancelled', 'completed'] };

// ---------- helpers ----------

const escapeLike = (text) => text.replace(/[\\%_]/g, '\\$&');
const reference = (id) => 'APT-' + String(id).padStart(4, '0');

function pagination(query) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize, 10) || 10));
    return { page, pageSize, offset: (page - 1) * pageSize };
}

const toUser = (r) => ({ id: r.user_id, full_name: r.full_name, email: r.email, role: r.role, is_active: r.is_active, created_at: r.created_at });

const APPOINTMENT_SELECT = `
    SELECT a.appointment_id, a.status, a.reason, a.appointment_date, a.created_at,
           s.user_id AS student_id, s.full_name AS student_name,
           f.user_id AS staff_id,   f.full_name AS staff_name,
           sv.service_id, sv.service_name
    FROM appointments a
    JOIN users s         ON s.user_id = a.student_id
    JOIN availability av ON av.availability_id = a.availability_id
    JOIN users f         ON f.user_id = av.staff_id
    JOIN services sv     ON sv.service_id = av.service_id`;

const toAppointment = (r) => ({
    id: r.appointment_id,
    reference: reference(r.appointment_id),
    status: r.status,
    reason: r.reason,
    date: r.appointment_date,
    created_at: r.created_at,
    student: { id: r.student_id, name: r.student_name },
    staff: { id: r.staff_id, name: r.staff_name },
    service: { id: r.service_id, name: r.service_name },
});

// ---------- dashboard ----------

async function dashboard(req, res) {
    const [users, byStatus, recent] = await Promise.all([
        pool.query(`
            SELECT COUNT(*)::int AS total,
                   COUNT(*) FILTER (WHERE role = 'student')::int AS students,
                   COUNT(*) FILTER (WHERE role = 'staff')::int AS staff,
                   COUNT(*) FILTER (WHERE role = 'staff' AND is_active)::int AS active_staff,
                   COUNT(*) FILTER (WHERE created_at >= date_trunc('month', CURRENT_TIMESTAMP))::int AS new_this_month
            FROM users`),
        pool.query('SELECT status, COUNT(*)::int AS count FROM appointments GROUP BY status'),
        pool.query(`${APPOINTMENT_SELECT} ORDER BY a.created_at DESC, a.appointment_id DESC LIMIT 5`),
    ]);

    const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    byStatus.rows.forEach((r) => { counts[r.status] = r.count; });
    const u = users.rows[0];

    res.json({
        users: { total: u.total, students: u.students, staff: u.staff, activeStaff: u.active_staff, newThisMonth: u.new_this_month },
        appointments: { total: Object.values(counts).reduce((a, b) => a + b, 0), pending: counts.pending, byStatus: counts },
        recentAppointments: recent.rows.map(toAppointment),
    });
}

// ---------- users ----------

async function listUsers(req, res) {
    const { page, pageSize, offset } = pagination(req.query);
    const where = [];
    const params = [];

    if (req.query.q) {
        params.push(`%${escapeLike(String(req.query.q).trim())}%`);
        where.push(`(full_name ILIKE $${params.length} OR email ILIKE $${params.length})`);
    }
    if (req.query.role) { params.push(req.query.role); where.push(`role = $${params.length}`); }
    if (req.query.status) { params.push(req.query.status === 'active'); where.push(`is_active = $${params.length}`); }

    const clause = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const [count, list] = await Promise.all([
        pool.query(`SELECT COUNT(*)::int AS total FROM users ${clause}`, params),
        pool.query(
            `SELECT user_id, full_name, email, role, is_active, created_at FROM users ${clause}
             ORDER BY created_at DESC, user_id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            [...params, pageSize, offset]
        ),
    ]);

    res.json({ items: list.rows.map(toUser), page, pageSize, total: count.rows[0].total });
}

async function createUser(req, res) {
    const { full_name, email, password, role, title, dept } = req.body;
    const password_hash = await bcrypt.hash(password, 10);
    try {
        const { rows } = await pool.query(
            `INSERT INTO users (full_name, email, password_hash, role, title, dept) VALUES ($1, $2, $3, $4, COALESCE($5, ''), COALESCE($6, ''))
             RETURNING user_id, full_name, email, role, is_active, created_at`,
            [full_name.trim(), email.trim().toLowerCase(), password_hash, role, title ?? null, dept ?? null]
        );
        res.status(201).json({ user: toUser(rows[0]) });
    } catch (err) {
        if (err.code === '23505') throw httpError(409, 'That email is already in use.');
        throw err;
    }
}

async function updateUser(req, res) {
    const id = Number(req.params.id);
    const { role, is_active } = req.body;

    // The caller is always an active admin, so blocking self-changes also guarantees
    // the system can never be left without an active admin.
    if (id === req.user.user_id) throw httpError(400, 'You cannot change your own role or deactivate your own account.');

    const { rows } = await pool.query(
        `UPDATE users SET role = COALESCE($2::varchar, role), is_active = COALESCE($3::boolean, is_active)
         WHERE user_id = $1
         RETURNING user_id, full_name, email, role, is_active, created_at`,
        [id, role ?? null, is_active ?? null]
    );
    if (!rows[0]) throw httpError(404, 'User not found.');
    res.json({ user: toUser(rows[0]) });
}

async function deleteUser(req, res) {
    const id = Number(req.params.id);
    if (id === req.user.user_id) throw httpError(400, 'You cannot delete your own account.');

    const target = await pool.query('SELECT user_id FROM users WHERE user_id = $1', [id]);
    if (!target.rows[0]) throw httpError(404, 'User not found.');

    // Anyone who appears in appointment records is kept for history: deactivate instead of deleting.
    const refs = await pool.query(
        `SELECT (SELECT COUNT(*) FROM appointments WHERE student_id = $1 OR reviewed_by = $1)::int
              + (SELECT COUNT(*) FROM appointments a JOIN availability av ON av.availability_id = a.availability_id WHERE av.staff_id = $1)::int
              + (SELECT COUNT(*) FROM appointment_history WHERE changed_by = $1)::int AS total`,
        [id]
    );
    if (refs.rows[0].total > 0) {
        throw httpError(409, 'This user appears in appointment records. Deactivate the account instead of deleting it.');
    }

    await withTransaction(async (client) => {
        await client.query('DELETE FROM availability WHERE staff_id = $1', [id]);
        await client.query('DELETE FROM staff_services WHERE staff_id = $1', [id]);
        await client.query('DELETE FROM users WHERE user_id = $1', [id]);
    });
    res.status(204).end();
}

// ---------- appointments ----------

async function listAppointments(req, res) {
    const { page, pageSize, offset } = pagination(req.query);
    const where = [];
    const params = [];

    if (req.query.q) {
        params.push(`%${escapeLike(String(req.query.q).trim())}%`);
        const n = params.length;
        where.push(`(s.full_name ILIKE $${n} OR f.full_name ILIKE $${n} OR ('APT-' || LPAD(a.appointment_id::text, 4, '0')) ILIKE $${n})`);
    }
    if (req.query.service) { params.push(Number(req.query.service)); where.push(`av.service_id = $${params.length}`); }
    if (req.query.status) { params.push(req.query.status); where.push(`a.status = $${params.length}`); }

    const clause = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const [count, list] = await Promise.all([
        pool.query(
            `SELECT COUNT(*)::int AS total
             FROM appointments a
             JOIN users s ON s.user_id = a.student_id
             JOIN availability av ON av.availability_id = a.availability_id
             JOIN users f ON f.user_id = av.staff_id ${clause}`,
            params
        ),
        pool.query(
            `${APPOINTMENT_SELECT} ${clause}
             ORDER BY a.appointment_date DESC, a.appointment_id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            [...params, pageSize, offset]
        ),
    ]);

    res.json({ items: list.rows.map(toAppointment), page, pageSize, total: count.rows[0].total });
}

async function changeAppointmentStatus(req, res) {
    const id = Number(req.params.id);
    const { status: next, notes } = req.body;

    await withTransaction(async (client) => {
        const found = await client.query(
            'SELECT status, availability_id FROM appointments WHERE appointment_id = $1 FOR UPDATE',
            [id]
        );
        const appt = found.rows[0];
        if (!appt) throw httpError(404, 'Appointment not found.');

        if (!(TRANSITIONS[appt.status] || []).includes(next)) {
            throw httpError(409, `A ${appt.status} appointment cannot be changed to ${next}.`);
        }

        if (next === 'approved') {
            // Lock the time slot so two admins cannot approve competing requests at the same moment.
            await client.query('SELECT availability_id FROM availability WHERE availability_id = $1 FOR UPDATE', [appt.availability_id]);
            const clash = await client.query(
                `SELECT 1 FROM appointments WHERE availability_id = $1 AND status = 'approved' AND appointment_id <> $2 LIMIT 1`,
                [appt.availability_id, id]
            );
            if (clash.rows.length) throw httpError(409, 'Another appointment is already approved for this time slot.');
        }

        const isReview = next === 'approved' || next === 'rejected';
        await client.query(
            `UPDATE appointments
             SET status = $2,
                 reviewed_by = COALESCE($3::int, reviewed_by),
                 reviewed_at = CASE WHEN $3::int IS NULL THEN reviewed_at ELSE CURRENT_TIMESTAMP END
             WHERE appointment_id = $1`,
            [id, next, isReview ? req.user.user_id : null]
        );
        await client.query(
            `INSERT INTO appointment_history (appointment_id, changed_by, old_status, new_status, notes)
             VALUES ($1, $2, $3, $4, $5)`,
            [id, req.user.user_id, appt.status, next, notes || null]
        );
    });

    const { rows } = await pool.query(`${APPOINTMENT_SELECT} WHERE a.appointment_id = $1`, [id]);
    res.json({ appointment: toAppointment(rows[0]) });
}

module.exports = { dashboard, listUsers, createUser, updateUser, deleteUser, listAppointments, changeAppointmentStatus, STATUSES };
