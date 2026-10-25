// authenticate: who is calling?   requireRole: are they allowed to?
// The user is re-read from the database on every request, so deactivating an account
// or changing its role takes effect immediately instead of waiting for the token to expire.
const pool = require('../db');
const { verify } = require('../utils/token');
const httpError = require('../utils/httpError');

async function authenticate(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const payload = verify(token);
    if (!payload) throw httpError(401, 'Please sign in to continue.');

    const { rows } = await pool.query(
        'SELECT user_id, full_name, email, role, is_active FROM users WHERE user_id = $1',
        [payload.sub]
    );
    const user = rows[0];
    if (!user || !user.is_active) throw httpError(401, 'Please sign in to continue.');

    req.user = user;
    next();
}

const requireRole = (...roles) => (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
        throw httpError(403, 'You do not have permission to do that.');
    }
    next();
};

module.exports = { authenticate, requireRole };
