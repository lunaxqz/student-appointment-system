// Demo-friendly defaults: no JWT_SECRET needed in development, demo admin created on an empty database.
// Production keeps the strict behaviour.
delete process.env.JWT_SECRET;
const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { mockDb } = require('./helpers');
delete process.env.JWT_SECRET; // helpers.js sets a test secret; these tests need it unset
const { sign, verify } = require('../utils/token');
const ensureDemoAdmin = require('../utils/demoAdmin');

const withEnv = async (env, fn) => {
    const saved = { ...process.env };
    Object.assign(process.env, env);
    try { return await fn(); } finally { process.env = saved; }
};

test('without JWT_SECRET, development still signs and verifies tokens', () => {
    const payload = verify(sign({ sub: 5, role: 'admin' }));
    assert.equal(payload.sub, 5);
});

test('without JWT_SECRET, production refuses to sign', async () => {
    await withEnv({ NODE_ENV: 'production' }, () => assert.throws(() => sign({ sub: 1 }), /JWT_SECRET/));
});

test('a token from a different run (different temporary secret) is not accepted', () => {
    const token = sign({ sub: 1 });
    const [h, , s] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ sub: 1, role: 'admin', exp: 9999999999 })).toString('base64url');
    assert.equal(verify(`${h}.${forged}.${s}`), null);
});

test('demo admin is created (password hashed) when the database has no admin', async () => {
    const db = mockDb([
        [/SELECT 1 FROM users WHERE role = 'admin'/, { rows: [] }],
        [/INSERT INTO users/, { rows: [{ user_id: 9 }] }],
    ]);
    assert.equal(await ensureDemoAdmin(), true);
    const insert = db.log.find((l) => /INSERT INTO users/.test(l.sql));
    assert.deepEqual([insert.params[0], insert.params[1]], ['Alex Admin', 'admin@wmsu.edu.ph']);
    assert.notEqual(insert.params[2], 'admin123');
    assert.ok(await bcrypt.compare('admin123', insert.params[2]));
});

test('demo admin is not created when an admin already exists', async () => {
    const db = mockDb([[/SELECT 1 FROM users WHERE role = 'admin'/, { rows: [{ '?column?': 1 }] }]]);
    assert.equal(await ensureDemoAdmin(), false);
    assert.equal(db.log.some((l) => /INSERT/.test(l.sql)), false);
});

test('demo admin is never created in production', async () => {
    const db = mockDb([]);
    await withEnv({ NODE_ENV: 'production' }, async () => assert.equal(await ensureDemoAdmin(), false));
    assert.equal(db.log.length, 0);
});
