// Demo convenience: when the database has no administrator yet, create the demo one so the Admin Dashboard
// can be signed into straight away (same account as the demo login: admin@wmsu.edu.ph / admin123).
// Never runs in production, and never touches a database that already has an admin.
const bcrypt = require('bcryptjs');
const pool = require('../db');

const DEMO_ADMIN = { name: 'Alex Admin', email: 'admin@wmsu.edu.ph', password: 'admin123' };

async function ensureDemoAdmin() {
    if (process.env.NODE_ENV === 'production') return false;

    const existing = await pool.query("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1");
    if (existing.rows.length) return false;

    const hash = await bcrypt.hash(DEMO_ADMIN.password, 10);
    const created = await pool.query(
        `INSERT INTO users (full_name, email, password_hash, role) VALUES ($1, $2, $3, 'admin')
         ON CONFLICT (email) DO NOTHING RETURNING user_id`,
        [DEMO_ADMIN.name, DEMO_ADMIN.email, hash]
    );
    if (created.rows.length) console.log(`Demo admin created: ${DEMO_ADMIN.email} / ${DEMO_ADMIN.password} (development only)`);
    return created.rows.length > 0;
}

module.exports = ensureDemoAdmin;
