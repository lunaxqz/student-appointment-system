// Display ID such as STU-0007 (server users) or STU-1042 (older local demo users).
const PREFIX = { student: 'STU', staff: 'FAC', admin: 'ADM' };

export function userCode(user) {
  // Users from the API have a numeric user_id, so the code is simply the role prefix plus that id.
  if (typeof user.id === 'number') return PREFIX[user.role] + '-' + String(user.id).padStart(4, '0');
  // Local demo users (still used by other admin screens) have string ids and keep the old derived number.
  const number = [...String(user.id)].reduce((sum, c) => (sum * 31 + c.charCodeAt(0)) % 9000, 7) + 1000;
  return PREFIX[user.role] + '-' + number;
}
