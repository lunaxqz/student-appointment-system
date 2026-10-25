// Test helpers: the database is replaced by an in-memory stub, so these tests need no PostgreSQL.
// They check routing, validation and permissions. They do NOT run the SQL itself;
// see the manual database checks in docs/admin-api.md for that.
process.env.JWT_SECRET = 'test-secret-for-unit-tests-only';

const pool = require('../db');
const app = require('../server');
const { sign } = require('../utils/token');

const ACTORS = {
    1: { user_id: 1, full_name: 'Alex Admin', email: 'admin@test.edu', role: 'admin', is_active: true },
    2: { user_id: 2, full_name: 'Sam Student', email: 'student@test.edu', role: 'student', is_active: true },
    3: { user_id: 3, full_name: 'Fay Faculty', email: 'faculty@test.edu', role: 'staff', is_active: true },
    4: { user_id: 4, full_name: 'Old Admin', email: 'old@test.edu', role: 'admin', is_active: false },
};
const tokenFor = (id) => sign({ sub: id, role: ACTORS[id].role });

// handlers: [[regex tested against the whitespace-normalised SQL, (params) => ({ rows })], ...]
function mockDb(handlers = []) {
    const log = [];
    const run = (tag) => async (sql, params = []) => {
        const text = sql.replace(/\s+/g, ' ').trim();
        log.push({ sql: text, params, tag });
        if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(text)) return { rows: [] };
        if (/FROM users WHERE user_id = \$1$/.test(text) && /SELECT user_id, full_name, email, role, is_active/.test(text)) {
            const actor = ACTORS[params[0]];
            return { rows: actor ? [actor] : [] };
        }
        for (const [pattern, reply] of handlers) {
            if (pattern.test(text)) {
                const out = typeof reply === 'function' ? reply(params, text) : reply;
                if (out instanceof Error) throw out;
                return out;
            }
        }
        throw new Error('Unexpected SQL in test: ' + text);
    };
    let released = 0;
    pool.query = run('pool');
    pool.connect = async () => ({ query: run('tx'), release: () => { released += 1; } });
    return { log, released: () => released };
}

async function startServer() {
    const server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;

    async function call(method, path, { token, body } = {}) {
        const res = await fetch(base + path, {
            method,
            headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) },
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        const text = await res.text();
        return { status: res.status, json: text ? JSON.parse(text) : null };
    }
    return { call, close: () => new Promise((resolve) => server.close(resolve)) };
}

module.exports = { ACTORS, tokenFor, mockDb, startServer };
