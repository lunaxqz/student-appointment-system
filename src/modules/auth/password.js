// Demo-grade hashing (SHA-256 + app salt). Use bcrypt/argon2 on a real server.
export async function hashPassword(s) {
  try {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('cb:' + s));
    return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
  } catch { return 'p:' + s; }
}
