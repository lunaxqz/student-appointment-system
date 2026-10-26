// Creates (or promotes) an administrator account in PostgreSQL.
// Usage:  node scripts/create-admin.js "Full Name" admin@example.com "a-strong-password"
const bcrypt = require('bcryptjs');
const pool = require('../db');

async function main() {
    const [fullName, emailArg, password] = process.argv.slice(2);
    if (!fullName || !emailArg || !password) {
        console.error('Usage: node scripts/create-admin.js "Full Name" email password');
        process.exitCode = 1;
        return;
    }
    if (password.length < 6) {
        console.error('Password must be at least 6 characters.');
        process.exitCode = 1;
        return;
    }

    const email = emailArg.trim().toLowerCase();
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
        `INSERT INTO users (full_name, email, password_hash, role)
         VALUES ($1, $2, $3, 'admin')
         ON CONFLICT (email) DO UPDATE SET role = 'admin', is_active = TRUE, password_hash = EXCLUDED.password_hash
         RETURNING user_id`,
        [fullName.trim(), email, hash]
    );
    console.log(`Admin ready: ${email} (user_id ${rows[0].user_id})`);
}

main()
    .catch((err) => { console.error('Could not create admin:', err.message); process.exitCode = 1; })
    .finally(() => pool.end());
