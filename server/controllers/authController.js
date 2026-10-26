// Provisional sign-in for the API. The admin routes only depend on `req.user`
// (see middleware/auth.js), so this file can be replaced by the team's own login later.
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { sign } = require('../utils/token');
const httpError = require('../utils/httpError');

// Compared against when the email is unknown, so "no such user" and "wrong password" take similar time.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

const publicUser = (u) => ({ id: u.user_id, name: u.full_name, email: u.email, role: u.role });

async function login(req, res) {
    const email = String(req.body.email).trim().toLowerCase();
    const { rows } = await pool.query(
        'SELECT user_id, full_name, email, password_hash, role, is_active FROM users WHERE email = $1',
        [email]
    );
    const user = rows[0];
    const passwordOk = await bcrypt.compare(String(req.body.password), user ? user.password_hash : DUMMY_HASH);

    if (!user || !passwordOk) throw httpError(401, 'Invalid email or password.');
    if (!user.is_active) throw httpError(403, 'This account has been deactivated.');

    res.json({ token: sign({ sub: user.user_id, role: user.role }), user: publicUser(user) });
}

function me(req, res) {
    res.json({ user: publicUser(req.user) });
}

// Self-service sign-up for students and faculty. Administrators can only be created by another administrator
// (Manage Users) or with `npm run create-admin`, never through this public route.
async function register(req, res) {
    const { full_name, password, role } = req.body;
    const isStudent = role === 'student';
    const student_id = isStudent ? String(req.body.student_id).trim() : null;
    const course = isStudent ? String(req.body.course).trim() : null;
    const password_hash = await bcrypt.hash(password, 10);

    try {
        const { rows } = await pool.query(
            `INSERT INTO users (full_name, email, password_hash, role, student_id, course) VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING user_id, full_name, email, role`,
            [full_name.trim(), String(req.body.email).trim().toLowerCase(), password_hash, role, student_id, course]
        );
        res.status(201).json({ token: sign({ sub: rows[0].user_id, role: rows[0].role }), user: publicUser(rows[0]) });
    } catch (err) {
        if (err.code === '23505') {
            throw httpError(409, /student_id/.test(err.constraint || '') ? 'An account with this student ID already exists.' : 'An account with this email already exists.');
        }
        throw err;
    }
}

async function changePassword(req, res) {
    const { rows } = await pool.query('SELECT password_hash FROM users WHERE user_id = $1', [req.user.user_id]);
    const ok = rows[0] && await bcrypt.compare(String(req.body.current_password), rows[0].password_hash);
    if (!ok) throw httpError(400, 'Current password is incorrect.');

    const password_hash = await bcrypt.hash(req.body.new_password, 10);
    await pool.query('UPDATE users SET password_hash = $2 WHERE user_id = $1', [req.user.user_id, password_hash]);
    res.status(204).end();
}

module.exports = { login, me, register, changePassword };
