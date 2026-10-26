process.env.JWT_SECRET = 'test-secret-for-unit-tests-only';
const test = require('node:test');
const assert = require('node:assert/strict');
const { sign, verify } = require('../utils/token');

test('a signed token verifies and carries its payload', () => {
    const payload = verify(sign({ sub: 7, role: 'admin' }));
    assert.equal(payload.sub, 7);
    assert.equal(payload.role, 'admin');
});

test('a tampered payload is rejected', () => {
    const [h, , s] = sign({ sub: 2, role: 'student' }).split('.');
    const forged = Buffer.from(JSON.stringify({ sub: 2, role: 'admin', exp: 9999999999 })).toString('base64url');
    assert.equal(verify(`${h}.${forged}.${s}`), null);
});

test('a token signed with another secret is rejected', () => {
    const token = sign({ sub: 1 });
    process.env.JWT_SECRET = 'a-completely-different-secret-value';
    assert.equal(verify(token), null);
    process.env.JWT_SECRET = 'test-secret-for-unit-tests-only';
});

test('an expired token is rejected', () => {
    assert.equal(verify(sign({ sub: 1 }, -10)), null);
});

test('garbage and non-strings are rejected', () => {
    for (const bad of ['', 'abc', 'a.b.c', undefined, null, 42]) assert.equal(verify(bad), null);
});

test('an unsigned "alg: none" token is rejected', () => {
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    assert.equal(verify(`${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: 1, role: 'admin', exp: 9999999999 })}.`), null);
});

test('signing without a proper JWT_SECRET fails loudly', () => {
    const saved = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'short';
    assert.throws(() => sign({ sub: 1 }), /JWT_SECRET/);
    process.env.JWT_SECRET = saved;
});
