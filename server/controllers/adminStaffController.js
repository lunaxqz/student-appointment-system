// Administration of faculty profiles, the list of services, and which faculty member offers which service.
const pool = require('../db');
const withTransaction = require('../utils/transaction');
const httpError = require('../utils/httpError');

const toStaff = (r) => ({
    id: r.user_id, full_name: r.full_name, email: r.email, is_active: r.is_active,
    title: r.title, dept: r.dept, bio: r.bio, service_ids: r.service_ids,
});

const STAFF_SELECT = `
    SELECT u.user_id, u.full_name, u.email, u.is_active, u.title, u.dept, u.bio,
           COALESCE((SELECT array_agg(ss.service_id ORDER BY ss.service_id) FROM staff_services ss
                     JOIN services s ON s.service_id = ss.service_id AND s.is_active
                     WHERE ss.staff_id = u.user_id), '{}') AS service_ids
    FROM users u`;

async function listStaff(req, res) {
    const { rows } = await pool.query(`${STAFF_SELECT} WHERE u.role = 'staff' ORDER BY u.full_name, u.user_id LIMIT 500`);
    res.json({ items: rows.map(toStaff) });
}

async function updateProfile(req, res) {
    const id = Number(req.params.id);
    const { title, dept, bio } = req.body;
    const { rows } = await pool.query(
        `UPDATE users SET title = COALESCE($2::varchar, title), dept = COALESCE($3::varchar, dept), bio = COALESCE($4::text, bio)
         WHERE user_id = $1 AND role = 'staff' RETURNING user_id`,
        [id, title ?? null, dept ?? null, bio ?? null]
    );
    if (!rows[0]) throw httpError(404, 'Faculty member not found.');
    const updated = await pool.query(`${STAFF_SELECT} WHERE u.user_id = $1`, [id]);
    res.json({ staff: toStaff(updated.rows[0]) });
}

// Replaces the set of services a faculty member offers.
async function setServices(req, res) {
    const id = Number(req.params.id);
    const wanted = [...new Set(req.body.service_ids.map(Number))];

    await withTransaction(async (client) => {
        const staff = await client.query(`SELECT user_id FROM users WHERE user_id = $1 AND role = 'staff' FOR UPDATE`, [id]);
        if (!staff.rows[0]) throw httpError(404, 'Faculty member not found.');

        const valid = await client.query('SELECT service_id FROM services WHERE service_id = ANY($1::int[]) AND is_active', [wanted]);
        if (valid.rows.length !== wanted.length) throw httpError(400, 'One of the chosen services does not exist.');

        const current = await client.query(
            `SELECT ss.service_id, s.service_name FROM staff_services ss JOIN services s ON s.service_id = ss.service_id AND s.is_active
             WHERE ss.staff_id = $1`, [id]
        );
        for (const row of current.rows.filter((r) => !wanted.includes(r.service_id))) {
            // Availability that nobody has booked goes with the service; booked history must stay.
            await client.query(
                `DELETE FROM availability WHERE staff_id = $1 AND service_id = $2
                 AND NOT EXISTS (SELECT 1 FROM appointments a WHERE a.availability_id = availability.availability_id)`,
                [id, row.service_id]
            );
            const left = await client.query('SELECT 1 FROM availability WHERE staff_id = $1 AND service_id = $2 LIMIT 1', [id, row.service_id]);
            if (left.rows[0]) throw httpError(409, `Appointments already exist for ${row.service_name}, so it cannot be removed from this person.`);
            await client.query('DELETE FROM staff_services WHERE staff_id = $1 AND service_id = $2', [id, row.service_id]);
        }
        for (const serviceId of wanted) {
            await client.query('INSERT INTO staff_services (staff_id, service_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, serviceId]);
        }
    });
    const { rows } = await pool.query(`${STAFF_SELECT} WHERE u.user_id = $1`, [id]);
    res.json({ staff: toStaff(rows[0]) });
}

async function createService(req, res) {
    const name = req.body.name.trim();
    // A service that was removed earlier (kept for history) is switched back on instead of failing on the unique name.
    const { rows } = await pool.query(
        `INSERT INTO services (service_name) VALUES ($1)
         ON CONFLICT (service_name) DO UPDATE SET is_active = TRUE WHERE services.is_active = FALSE
         RETURNING service_id, service_name, description`,
        [name]
    );
    if (!rows[0]) throw httpError(409, 'That service already exists.');
    res.status(201).json({ service: { id: rows[0].service_id, name: rows[0].service_name, description: rows[0].description } });
}

async function deleteService(req, res) {
    const id = Number(req.params.id);
    await withTransaction(async (client) => {
        const found = await client.query('SELECT service_id FROM services WHERE service_id = $1 AND is_active FOR UPDATE', [id]);
        if (!found.rows[0]) throw httpError(404, 'Service not found.');

        const used = await client.query('SELECT 1 FROM availability WHERE service_id = $1 LIMIT 1', [id]);
        if (used.rows[0]) {
            // Appointments may point at it: hide it everywhere but keep the record.
            await client.query('UPDATE services SET is_active = FALSE WHERE service_id = $1', [id]);
        } else {
            await client.query('DELETE FROM staff_services WHERE service_id = $1', [id]);
            await client.query('DELETE FROM services WHERE service_id = $1', [id]);
        }
    });
    res.status(204).end();
}

module.exports = { listStaff, updateProfile, setServices, createService, deleteService };
