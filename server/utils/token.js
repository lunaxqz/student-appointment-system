// Minimal signed login tokens (HMAC-SHA256, JWT-compatible format) built on Node's crypto module.
// To switch to the `jsonwebtoken` package later, only sign() and verify() need to change.
const crypto = require('crypto');

const DEFAULT_LIFETIME_SECONDS = 8 * 60 * 60; // one working day

const b64url = (input) => Buffer.from(input).toString('base64url');

// Development convenience: with no JWT_SECRET configured, a random secret is generated each time the server
// starts, so a demo needs no setup. Tokens simply stop working after a restart (people sign in again).
// In production (NODE_ENV=production) a missing secret is an error, and a secret that is set but too short
// is always an error.
let devSecret = null;

function getSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret && process.env.NODE_ENV !== 'production') {
        if (!devSecret) {
            devSecret = crypto.randomBytes(32).toString('hex');
            console.warn('JWT_SECRET is not set: using a temporary secret for this run (fine for demos, not for production).');
        }
        return devSecret;
    }
    if (!secret || secret.length < 16) {
        throw new Error('JWT_SECRET is missing or too short. Set it in server/.env (16+ characters).');
    }
    return secret;
}

function signature(data, secret) {
    return crypto.createHmac('sha256', secret).update(data).digest('base64url');
}

function sign(payload, lifetimeSeconds = DEFAULT_LIFETIME_SECONDS) {
    const now = Math.floor(Date.now() / 1000);
    const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const body = b64url(JSON.stringify({ ...payload, iat: now, exp: now + lifetimeSeconds }));
    return `${header}.${body}.${signature(`${header}.${body}`, getSecret())}`;
}

// Returns the payload, or null when the token is malformed, tampered with, or expired.
function verify(token) {
    if (typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, body, sig] = parts;
    const expected = Buffer.from(signature(`${header}.${body}`, getSecret()));
    const actual = Buffer.from(sig);
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;

    try {
        const parsedHeader = JSON.parse(Buffer.from(header, 'base64url').toString());
        if (parsedHeader.alg !== 'HS256') return null;
        const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
        if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
        return payload;
    } catch {
        return null;
    }
}

module.exports = { sign, verify };
