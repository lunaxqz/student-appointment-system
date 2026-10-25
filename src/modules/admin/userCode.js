// Display ID such as STU-1042, built from the role and the user's id.
const PREFIX = { student: 'STU', staff: 'FAC', admin: 'ADM' };

export function userCode(user) {
  const number = [...user.id].reduce((sum, c) => (sum * 31 + c.charCodeAt(0)) % 9000, 7) + 1000;
  return PREFIX[user.role] + '-' + number;
}
