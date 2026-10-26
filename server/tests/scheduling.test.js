// Routing, permissions and validation for registration, the faculty catalogue, availability and appointments.
// The database is stubbed (see helpers.js), so the SQL itself is not run here.
const test = require('node:test');
const assert = require('node:assert/strict');
const { tokenFor, mockDb, startServer } = require('./helpers');

let api;
test.before(async () => { api = await startServer(); });
test.after(() => api.close());

const ADMIN = tokenFor(1);
const STUDENT = tokenFor(2);
const STAFF = tokenFor(3);

const PROTECTED = [
    ['GET', '/api/services'],
    ['GET', '/api/faculty'],
    ['GET', '/api/faculty/3/slots'],
    ['GET', '/api/staff/3/schedule?from=2026-11-02&to=2026-11-08'],
    ['POST', '/api/availability', { service_id: 1, weekday: 1, start: '09:00', end: '10:00' }],
    ['DELETE', '/api/availability/5'],
    ['GET', '/api/appointments'],
    ['POST', '/api/appointments', { staff_id: 3, service_id: 1, date: '2030-01-07', time: '09:00' }],
    ['PATCH', '/api/appointments/5/status', { status: 'cancelled' }],
    ['PATCH', '/api/auth/password', { current_password: 'a', new_password: 'secret1' }],
    ['GET', '/api/admin/staff'],
    ['POST', '/api/admin/services', { name: 'Library' }],
];

test('everything that needs a sign-in rejects anonymous callers with 401 and never touches data', async () => {
    const db = mockDb([]);
    for (const [method, path, body] of PROTECTED) {
        const res = await api.call(method, path, { body });
        assert.equal(res.status, 401, `${method} ${path}`);
    }
    assert.equal(db.log.length, 0);
});

test('admin-only staff and service routes reject students and faculty', async () => {
    mockDb([]);
    for (const token of [STUDENT, STAFF]) {
        for (const [method, path, body] of [['GET', '/api/admin/staff'], ['POST', '/api/admin/services', { name: 'Library' }], ['PUT', '/api/admin/staff/3/services', { service_ids: [1] }]]) {
            assert.equal((await api.call(method, path, { token, body })).status, 403, `${method} ${path}`);
        }
    }
});

test('only students book; only students and faculty list their own appointments', async () => {
    mockDb([]);
    const body = { staff_id: 3, service_id: 1, date: '2030-01-07', time: '09:00' };
    assert.equal((await api.call('POST', '/api/appointments', { token: STAFF, body })).status, 403);
    assert.equal((await api.call('POST', '/api/appointments', { token: ADMIN, body })).status, 403);
    assert.equal((await api.call('GET', '/api/appointments', { token: ADMIN })).status, 403);
});

test('students cannot manage availability', async () => {
    mockDb([]);
    const res = await api.call('POST', '/api/availability', { token: STUDENT, body: { service_id: 1, weekday: 1, start: '09:00', end: '10:00' } });
    assert.equal(res.status, 403);
});

test('faculty can only view their own schedule', async () => {
    mockDb([]);
    const res = await api.call('GET', '/api/staff/99/schedule?from=2026-11-02&to=2026-11-08', { token: STAFF });
    assert.equal(res.status, 403);
});

test('schedule dates and availability times are validated', async () => {
    mockDb([]);
    assert.equal((await api.call('GET', '/api/staff/3/schedule?from=nope&to=2026-11-08', { token: STAFF })).status, 400);
    assert.equal((await api.call('GET', '/api/staff/3/schedule?from=2026-11-08&to=2026-11-02', { token: STAFF })).status, 400);
    for (const bad of [{ start: '9am' }, { end: '25:00' }, { weekday: 7 }, { service_id: 0 }]) {
        const body = { service_id: 1, weekday: 1, start: '09:00', end: '10:00', ...bad };
        assert.equal((await api.call('POST', '/api/availability', { token: STAFF, body })).status, 400, JSON.stringify(bad));
    }
});

test('booking validates its input and refuses times in the past', async () => {
    mockDb([]);
    const good = { staff_id: 3, service_id: 1, date: '2030-01-07', time: '09:00' };
    for (const bad of [{ date: '2030-02-30' }, { time: '9:00' }, { staff_id: 'x' }, { service_id: 0 }, { reason: 'x'.repeat(1001) }]) {
        assert.equal((await api.call('POST', '/api/appointments', { token: STUDENT, body: { ...good, ...bad } })).status, 400, JSON.stringify(bad));
    }
    const past = await api.call('POST', '/api/appointments', { token: STUDENT, body: { ...good, date: '2020-01-06' } });
    assert.equal(past.status, 400);
    assert.match(past.json.message, /passed/i);
});

test('registration only creates students or faculty, never administrators', async () => {
    mockDb([]);
    const good = { full_name: 'Jo Doe', email: 'jo@test.edu', password: 'secret1', role: 'student', student_id: '2024-0001', course: 'BSCS' };
    for (const bad of [{ role: 'admin' }, { password: '123' }, { email: 'nope' }, { student_id: undefined }, { course: undefined }, { full_name: '  ' }]) {
        assert.equal((await api.call('POST', '/api/auth/register', { body: { ...good, ...bad } })).status, 400, JSON.stringify(bad));
    }
});

test('registration signs the new user in and stores them in the users table', async () => {
    const db = mockDb([[/^INSERT INTO users/, (p) => ({ rows: [{ user_id: 30, full_name: p[0], email: p[1], role: p[3] }] })]]);
    const res = await api.call('POST', '/api/auth/register', { body: { full_name: ' Jo Doe ', email: ' Jo@Test.EDU ', password: 'secret1', role: 'student', student_id: ' 2024-0001 ', course: 'BSCS' } });
    assert.equal(res.status, 201);
    assert.equal(res.json.user.email, 'jo@test.edu');
    assert.equal(res.json.user.role, 'student');
    assert.ok(res.json.token);
    const insert = db.log.find((q) => /^INSERT INTO users/.test(q.sql));
    assert.equal(insert.params[0], 'Jo Doe');
    assert.equal(insert.params[4], '2024-0001');
    assert.notEqual(insert.params[2], 'secret1'); // stored hashed
});

test('a duplicate email or student ID is a 409 with a clear message', async () => {
    mockDb([[/^INSERT INTO users/, Object.assign(new Error('dup'), { code: '23505', constraint: 'users_email_key' })]]);
    const body = { full_name: 'Jo', email: 'jo@test.edu', password: 'secret1', role: 'student', student_id: '1', course: 'x' };
    const email = await api.call('POST', '/api/auth/register', { body });
    assert.equal(email.status, 409);
    assert.match(email.json.message, /email/i);

    mockDb([[/^INSERT INTO users/, Object.assign(new Error('dup'), { code: '23505', constraint: 'users_student_id_key' })]]);
    const sid = await api.call('POST', '/api/auth/register', { body });
    assert.equal(sid.status, 409);
    assert.match(sid.json.message, /student ID/i);
});

test('admin staff routes validate their input', async () => {
    mockDb([]);
    assert.equal((await api.call('POST', '/api/admin/services', { token: ADMIN, body: { name: '   ' } })).status, 400);
    assert.equal((await api.call('PUT', '/api/admin/staff/3/services', { token: ADMIN, body: { service_ids: 'all' } })).status, 400);
    assert.equal((await api.call('PUT', '/api/admin/staff/3/services', { token: ADMIN, body: { service_ids: [0] } })).status, 400);
    assert.equal((await api.call('PATCH', '/api/admin/staff/3', { token: ADMIN, body: { bio: 'x'.repeat(1001) } })).status, 400);
});
