const test = require('node:test');
const assert = require('node:assert/strict');
const { tokenFor, mockDb, startServer } = require('./helpers');

let api;
test.before(async () => { api = await startServer(); });
test.after(() => api.close());

const ADMIN = tokenFor(1);
const STUDENT = tokenFor(2);
const STAFF = tokenFor(3);
const DEACTIVATED_ADMIN = tokenFor(4);

const apptRow = (extra = {}) => ({
    appointment_id: 12, status: 'pending', reason: 'Thesis', appointment_date: '2026-11-02T09:00:00Z', created_at: '2026-10-20T08:00:00Z',
    student_id: 2, student_name: 'Sam Student', staff_id: 3, staff_name: 'Fay Faculty', service_id: 1, service_name: 'Academic Advising', ...extra,
});

// ---------- authorization: the most important group ----------

const ADMIN_ROUTES = [
    ['GET', '/api/admin/dashboard'],
    ['GET', '/api/admin/users'],
    ['POST', '/api/admin/users', { full_name: 'X', email: 'x@y.edu', password: 'secret1', role: 'student' }],
    ['PATCH', '/api/admin/users/5', { is_active: false }],
    ['DELETE', '/api/admin/users/5'],
    ['GET', '/api/admin/appointments'],
    ['PATCH', '/api/admin/appointments/12/status', { status: 'approved' }],
];

test('every admin route rejects anonymous callers with 401 and never touches data', async () => {
    const db = mockDb([]);
    for (const [method, path, body] of ADMIN_ROUTES) {
        const res = await api.call(method, path, { body });
        assert.equal(res.status, 401, `${method} ${path}`);
    }
    assert.equal(db.log.length, 0);
});

test('every admin route rejects students and faculty with 403', async () => {
    const db = mockDb([]);
    for (const token of [STUDENT, STAFF]) {
        for (const [method, path, body] of ADMIN_ROUTES) {
            const res = await api.call(method, path, { token, body });
            assert.equal(res.status, 403, `${method} ${path}`);
        }
    }
    assert.equal(db.log.some((q) => !/FROM users WHERE user_id = \$1$/.test(q.sql)), false, 'only the identity lookup ran');
});

test('a token for a deactivated admin stops working immediately', async () => {
    mockDb([]);
    assert.equal((await api.call('GET', '/api/admin/dashboard', { token: DEACTIVATED_ADMIN })).status, 401);
});

test('a forged or malformed token is rejected', async () => {
    mockDb([]);
    assert.equal((await api.call('GET', '/api/admin/dashboard', { token: 'not.a.token' })).status, 401);
    const [h, , s] = STUDENT.split('.');
    const forged = Buffer.from(JSON.stringify({ sub: 1, role: 'admin', exp: 9999999999 })).toString('base64url');
    assert.equal((await api.call('GET', '/api/admin/dashboard', { token: `${h}.${forged}.${s}` })).status, 401);
});

// ---------- dashboard ----------

test('dashboard combines user counts, status counts and recent appointments', async () => {
    mockDb([
        [/COUNT\(\*\)::int AS total.*FROM users$/, { rows: [{ total: 1248, students: 1100, staff: 84, active_staff: 78, new_this_month: 32 }] }],
        [/GROUP BY status/, { rows: [{ status: 'approved', count: 6 }, { status: 'pending', count: 2 }] }],
        [/ORDER BY a.created_at DESC.*LIMIT 5/, { rows: [apptRow()] }],
    ]);
    const res = await api.call('GET', '/api/admin/dashboard', { token: ADMIN });
    assert.equal(res.status, 200);
    assert.deepEqual(res.json.users, { total: 1248, students: 1100, staff: 84, activeStaff: 78, newThisMonth: 32 });
    assert.equal(res.json.appointments.total, 8);
    assert.equal(res.json.appointments.pending, 2);
    assert.deepEqual(res.json.appointments.byStatus, { pending: 2, approved: 6, rejected: 0, cancelled: 0, completed: 0 });
    assert.equal(res.json.recentAppointments[0].reference, 'APT-0012');
});

// ---------- users ----------

test('user list passes search text as a parameter, never inside the SQL', async () => {
    const evil = "x'; DROP TABLE users; --";
    const db = mockDb([
        [/SELECT COUNT\(\*\)::int AS total FROM users/, { rows: [{ total: 0 }] }],
        [/SELECT user_id, full_name, email, role, is_active, created_at FROM users/, { rows: [] }],
    ]);
    const res = await api.call('GET', '/api/admin/users?q=' + encodeURIComponent(evil) + '&role=staff&status=active&page=2&pageSize=5', { token: ADMIN });
    assert.equal(res.status, 200);
    const list = db.log.find((q) => /ORDER BY created_at/.test(q.sql));
    assert.equal(list.sql.includes('DROP TABLE'), false);
    assert.ok(list.params.includes('%' + evil + '%'));
    assert.deepEqual(list.params.slice(-2), [5, 5], 'LIMIT 5 OFFSET 5 for page 2');
    assert.equal(res.json.page, 2);
});

test('LIKE wildcards in the search text are escaped', async () => {
    const db = mockDb([[/COUNT/, { rows: [{ total: 0 }] }], [/ORDER BY/, { rows: [] }]]);
    await api.call('GET', '/api/admin/users?q=' + encodeURIComponent('50%_off'), { token: ADMIN });
    assert.ok(db.log[1].params.includes('%50\\%\\_off%'));
});

test('user list rejects bad filters with 400', async () => {
    mockDb([]);
    for (const qs of ['role=hacker', 'status=maybe', 'page=0', 'pageSize=1000', 'pageSize=abc']) {
        assert.equal((await api.call('GET', '/api/admin/users?' + qs, { token: ADMIN })).status, 400, qs);
    }
});

test('creating a user validates input', async () => {
    mockDb([]);
    const good = { full_name: 'Jo Doe', email: 'jo@test.edu', password: 'secret1', role: 'student' };
    const bad = [
        { ...good, full_name: '   ' }, { ...good, email: 'not-an-email' }, { ...good, password: '123' },
        { ...good, password: 'x'.repeat(73) }, { ...good, role: 'superuser' }, {},
    ];
    for (const body of bad) assert.equal((await api.call('POST', '/api/admin/users', { token: ADMIN, body })).status, 400, JSON.stringify(body));
});

test('creating a user stores a bcrypt hash, normalises the email and never returns the hash', async () => {
    const db = mockDb([[/^INSERT INTO users/, (p) => ({ rows: [{ user_id: 20, full_name: p[0], email: p[1], role: p[3], is_active: true, created_at: '2026-10-26' }] })]]);
    const res = await api.call('POST', '/api/admin/users', { token: ADMIN, body: { full_name: ' Jo Doe ', email: ' Jo@Test.EDU ', password: 'secret1', role: 'staff' } });
    assert.equal(res.status, 201);
    assert.equal(res.json.user.email, 'jo@test.edu');
    assert.equal(res.json.user.full_name, 'Jo Doe');
    const insert = db.log.find((q) => /^INSERT INTO users/.test(q.sql));
    assert.match(insert.params[2], /^\$2[aby]\$/, 'password is hashed');
    assert.notEqual(insert.params[2], 'secret1');
    assert.equal(JSON.stringify(res.json).includes('password'), false);
});

test('a duplicate email is a 409, not a 500', async () => {
    mockDb([[/^INSERT INTO users/, Object.assign(new Error('duplicate key'), { code: '23505' })]]);
    const res = await api.call('POST', '/api/admin/users', { token: ADMIN, body: { full_name: 'Jo', email: 'jo@test.edu', password: 'secret1', role: 'student' } });
    assert.equal(res.status, 409);
    assert.match(res.json.message, /already in use/);
});

test('an admin can change another user’s role and active flag', async () => {
    const db = mockDb([[/^UPDATE users SET/, (p) => ({ rows: [{ user_id: p[0], full_name: 'Fay', email: 'f@t.edu', role: p[1] ?? 'staff', is_active: p[2] ?? true, created_at: 'x' }] })]]);
    const res = await api.call('PATCH', '/api/admin/users/3', { token: ADMIN, body: { role: 'admin', is_active: false } });
    assert.equal(res.status, 200);
    assert.deepEqual(db.log.find((q) => /^UPDATE users/.test(q.sql)).params, [3, 'admin', false]);
    assert.equal(res.json.user.role, 'admin');
});

test('an admin cannot demote or deactivate themselves', async () => {
    const db = mockDb([]);
    for (const body of [{ role: 'student' }, { is_active: false }]) {
        assert.equal((await api.call('PATCH', '/api/admin/users/1', { token: ADMIN, body })).status, 400);
    }
    assert.equal(db.log.some((q) => /^UPDATE/.test(q.sql)), false);
});

test('user updates validate input, including an empty or missing body', async () => {
    mockDb([]);
    assert.equal((await api.call('PATCH', '/api/admin/users/abc', { token: ADMIN, body: { role: 'staff' } })).status, 400);
    assert.equal((await api.call('PATCH', '/api/admin/users/3', { token: ADMIN, body: { role: 'wizard' } })).status, 400);
    assert.equal((await api.call('PATCH', '/api/admin/users/3', { token: ADMIN, body: { is_active: 'yes' } })).status, 400);
    assert.equal((await api.call('PATCH', '/api/admin/users/3', { token: ADMIN, body: {} })).status, 400);
    assert.equal((await api.call('PATCH', '/api/admin/users/3', { token: ADMIN })).status, 400);
});

test('updating a user that does not exist is 404', async () => {
    mockDb([[/^UPDATE users SET/, { rows: [] }]]);
    assert.equal((await api.call('PATCH', '/api/admin/users/99', { token: ADMIN, body: { is_active: true } })).status, 404);
});

test('deleting: not yourself, not a missing user, not someone with appointment records', async () => {
    mockDb([]);
    assert.equal((await api.call('DELETE', '/api/admin/users/1', { token: ADMIN })).status, 400);

    mockDb([[/SELECT user_id FROM users WHERE user_id = \$1/, { rows: [] }]]);
    assert.equal((await api.call('DELETE', '/api/admin/users/99', { token: ADMIN })).status, 404);

    const db = mockDb([
        [/SELECT user_id FROM users WHERE user_id = \$1/, { rows: [{ user_id: 2 }] }],
        [/AS total$/, { rows: [{ total: 3 }] }],
    ]);
    const res = await api.call('DELETE', '/api/admin/users/2', { token: ADMIN });
    assert.equal(res.status, 409);
    assert.equal(db.log.some((q) => /^DELETE/.test(q.sql)), false);
});

test('deleting an unreferenced user removes related rows in one transaction', async () => {
    const db = mockDb([
        [/SELECT user_id FROM users WHERE user_id = \$1/, { rows: [{ user_id: 7 }] }],
        [/AS total$/, { rows: [{ total: 0 }] }],
        [/^DELETE FROM/, { rows: [] }],
    ]);
    const res = await api.call('DELETE', '/api/admin/users/7', { token: ADMIN });
    assert.equal(res.status, 204);
    const tx = db.log.filter((q) => q.tag === 'tx').map((q) => q.sql.split(' ').slice(0, 3).join(' '));
    assert.deepEqual(tx, ['BEGIN', 'DELETE FROM availability', 'DELETE FROM staff_services', 'DELETE FROM users', 'COMMIT']);
    assert.equal(db.released(), 1, 'database connection is returned to the pool');
});

// ---------- appointments ----------

test('appointment list filters by status/service/search through parameters and paginates', async () => {
    const db = mockDb([[/SELECT COUNT\(\*\)::int AS total FROM appointments/, { rows: [{ total: 13 }] }], [/ORDER BY a.appointment_date DESC/, { rows: [apptRow()] }]]);
    const res = await api.call('GET', '/api/admin/appointments?status=pending&service=1&q=fay&page=3&pageSize=4', { token: ADMIN });
    assert.equal(res.status, 200);
    assert.equal(res.json.total, 13);
    assert.equal(res.json.items[0].student.name, 'Sam Student');
    const list = db.log.find((q) => /ORDER BY a.appointment_date/.test(q.sql));
    assert.deepEqual(list.params, ['%fay%', 1, 'pending', 4, 8]);
});

test('appointment list rejects unknown statuses and bad service ids', async () => {
    mockDb([]);
    assert.equal((await api.call('GET', '/api/admin/appointments?status=weird', { token: ADMIN })).status, 400);
    assert.equal((await api.call('GET', '/api/admin/appointments?service=abc', { token: ADMIN })).status, 400);
});

const statusMocks = (current, extra = []) => [
    [/FROM appointments WHERE appointment_id = \$1 FOR UPDATE/, { rows: current ? [{ status: current, availability_id: 5 }] : [] }],
    [/FROM availability WHERE availability_id = \$1 FOR UPDATE/, { rows: [{ availability_id: 5 }] }],
    [/AND status = 'approved' AND appointment_id <> \$2/, { rows: [] }],
    [/^UPDATE appointments/, { rows: [] }],
    [/^INSERT INTO appointment_history/, { rows: [] }],
    [/WHERE a.appointment_id = \$1$/, () => ({ rows: [apptRow({ status: 'approved' })] })],
    ...extra,
];

test('approving a pending appointment records the reviewer and a history row, atomically', async () => {
    const db = mockDb(statusMocks('pending'));
    const res = await api.call('PATCH', '/api/admin/appointments/12/status', { token: ADMIN, body: { status: 'approved', notes: 'OK' } });
    assert.equal(res.status, 200);
    assert.equal(res.json.appointment.status, 'approved');
    const tx = db.log.filter((q) => q.tag === 'tx');
    assert.equal(tx[0].sql, 'BEGIN');
    assert.equal(tx.at(-1).sql, 'COMMIT');
    assert.deepEqual(tx.find((q) => /^UPDATE appointments/.test(q.sql)).params, [12, 'approved', 1]);
    assert.deepEqual(tx.find((q) => /^INSERT INTO appointment_history/.test(q.sql)).params, [12, 1, 'pending', 'approved', 'OK']);
    assert.equal(db.released(), 1);
});

test('cancelling or completing does not overwrite the original reviewer', async () => {
    const db = mockDb(statusMocks('approved'));
    const res = await api.call('PATCH', '/api/admin/appointments/12/status', { token: ADMIN, body: { status: 'completed' } });
    assert.equal(res.status, 200);
    assert.deepEqual(db.log.find((q) => /^UPDATE appointments/.test(q.sql)).params, [12, 'completed', null]);
});

test('invalid transitions are 409 and roll back without writing', async () => {
    for (const [from, to] of [['completed', 'pending'], ['rejected', 'approved'], ['pending', 'completed'], ['cancelled', 'approved'], ['pending', 'cancelled']]) {
        const db = mockDb(statusMocks(from));
        const res = await api.call('PATCH', '/api/admin/appointments/12/status', { token: ADMIN, body: { status: to } });
        assert.equal(res.status, 409, `${from} -> ${to}`);
        assert.equal(db.log.some((q) => /^(UPDATE|INSERT)/.test(q.sql)), false);
        assert.equal(db.log.some((q) => q.sql === 'ROLLBACK'), true);
        assert.equal(db.released(), 1, 'connection released even on failure');
    }
});

test('approval is refused when another appointment already holds the slot', async () => {
    // Handlers are matched in order, so the override goes first.
    const db = mockDb([[/AND status = 'approved' AND appointment_id <> \$2/, { rows: [{ clash: 1 }] }], ...statusMocks('pending')]);
    const res = await api.call('PATCH', '/api/admin/appointments/12/status', { token: ADMIN, body: { status: 'approved' } });
    assert.equal(res.status, 409);
    assert.match(res.json.message, /already approved/);
    assert.equal(db.log.some((q) => /^(UPDATE|INSERT)/.test(q.sql)), false);
    assert.equal(db.log.some((q) => q.sql === 'ROLLBACK'), true);
});

test('status change handles missing appointments and bad input', async () => {
    mockDb(statusMocks(null));
    assert.equal((await api.call('PATCH', '/api/admin/appointments/999/status', { token: ADMIN, body: { status: 'approved' } })).status, 404);
    mockDb([]);
    assert.equal((await api.call('PATCH', '/api/admin/appointments/12/status', { token: ADMIN, body: { status: 'bogus' } })).status, 400);
    assert.equal((await api.call('PATCH', '/api/admin/appointments/12/status', { token: ADMIN, body: {} })).status, 400);
    assert.equal((await api.call('PATCH', '/api/admin/appointments/abc/status', { token: ADMIN, body: { status: 'approved' } })).status, 400);
    assert.equal((await api.call('PATCH', '/api/admin/appointments/12/status', { token: ADMIN, body: { status: 'approved', notes: 'n'.repeat(501) } })).status, 400);
});

test('database failures return a generic 500 without leaking details', async () => {
    mockDb([[/COUNT/, new Error('relation "secret_table" does not exist')]]);
    const res = await api.call('GET', '/api/admin/dashboard', { token: ADMIN });
    assert.equal(res.status, 500);
    assert.equal(JSON.stringify(res.json).includes('secret_table'), false);
});
