const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { mockDb, startServer } = require('./helpers');

let api;
test.before(async () => { api = await startServer(); });
test.after(() => api.close());

const hash = bcrypt.hashSync('correct-horse', 4);
const row = (extra = {}) => ({ user_id: 9, full_name: 'Ada Admin', email: 'ada@test.edu', password_hash: hash, role: 'admin', is_active: true, ...extra });
const lookup = (user) => [/FROM users WHERE email = \$1/, () => ({ rows: user ? [user] : [] })];

test('login succeeds with the right password and returns a token without the hash', async () => {
    const db = mockDb([lookup(row())]);
    const res = await api.call('POST', '/api/auth/login', { body: { email: '  ADA@test.edu ', password: 'correct-horse' } });
    assert.equal(res.status, 200);
    assert.ok(res.json.token);
    assert.deepEqual(res.json.user, { id: 9, name: 'Ada Admin', email: 'ada@test.edu', role: 'admin' });
    assert.equal(JSON.stringify(res.json).includes('password'), false);
    assert.equal(db.log[0].params[0], 'ada@test.edu', 'email is trimmed and lower-cased');
});

test('wrong password and unknown email give the same 401 message', async () => {
    mockDb([lookup(row())]);
    const wrong = await api.call('POST', '/api/auth/login', { body: { email: 'ada@test.edu', password: 'nope' } });
    mockDb([lookup(null)]);
    const unknown = await api.call('POST', '/api/auth/login', { body: { email: 'who@test.edu', password: 'nope' } });
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.equal(wrong.json.message, unknown.json.message);
});

test('a deactivated account cannot sign in even with the right password', async () => {
    mockDb([lookup(row({ is_active: false }))]);
    const res = await api.call('POST', '/api/auth/login', { body: { email: 'ada@test.edu', password: 'correct-horse' } });
    assert.equal(res.status, 403);
});

test('missing fields and missing body are 400, not 500', async () => {
    mockDb([]);
    assert.equal((await api.call('POST', '/api/auth/login', { body: { email: 'a@b.c' } })).status, 400);
    assert.equal((await api.call('POST', '/api/auth/login', { body: { password: 'x' } })).status, 400);
    assert.equal((await api.call('POST', '/api/auth/login')).status, 400);
});

test('/me returns the signed-in user and rejects anonymous calls', async () => {
    mockDb([]);
    const { tokenFor } = require('./helpers');
    const ok = await api.call('GET', '/api/auth/me', { token: tokenFor(2) });
    assert.equal(ok.status, 200);
    assert.equal(ok.json.user.role, 'student');
    assert.equal((await api.call('GET', '/api/auth/me')).status, 401);
});
