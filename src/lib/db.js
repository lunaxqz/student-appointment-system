// Database layer. Everything that reads/writes storage lives here.
// Tables: users, services, staff_services, availability, appointments, appointment_history
import { hashPassword } from '../modules/auth/password.js';
import { uid } from './utils.js';

const KEY = 'campusbook_db_v1';

export function loadDb() {
  try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
}
export function saveDb(db) {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* storage unavailable */ }
}
export const getSession = () => { try { return sessionStorage.getItem(KEY + 'u'); } catch { return null; } };
export const setSession = (id) => { try { id ? sessionStorage.setItem(KEY + 'u', id) : sessionStorage.removeItem(KEY + 'u'); } catch { /* ignore */ } };

export async function seedDb() {
  const u = async (id, name, email, pw, role, x = {}) => ({
    id, name, email, password_hash: await hashPassword(pw), role, active: true, title: '', dept: '', bio: '', ...x,
  });
  const users = await Promise.all([
    u('u_admin', 'Alex Admin', 'admin@wmsu.edu.ph', 'admin123', 'admin'),
    u('u_t1', 'Dr. Maria Reyes', 'reyes@wmsu.edu.ph', 'staff123', 'staff', { title: 'Associate Professor', dept: 'College of Computing', bio: 'Thesis advising and academic planning.' }),
    u('u_t2', 'Mr. Jun Santos', 'santos@wmsu.edu.ph', 'staff123', 'staff', { title: 'Registrar Officer', dept: 'Registrar’s Office', bio: 'Enrollment, records and clearance.' }),
    u('u_t3', 'Ms. Lea Cruz', 'cruz@wmsu.edu.ph', 'staff123', 'staff', { title: 'Guidance Counselor', dept: 'Student Affairs', bio: 'Confidential counseling and wellness.' }),
    u('u_s1', 'Mark Santos', 'marksantos@wmsu.edu.ph', 'student123', 'student'),
  ]);
  const av = (s, w, a, b) => ({ id: uid('a'), staff_id: s, weekday: w, start: a, end: b });
  const db = {
    users,
    services: [{ id: 'sv1', name: 'Academic Advising' }, { id: 'sv2', name: 'Registrar Services' }, { id: 'sv3', name: 'Counseling' }],
    staff_services: [{ staff_id: 'u_t1', service_id: 'sv1' }, { staff_id: 'u_t2', service_id: 'sv2' }, { staff_id: 'u_t3', service_id: 'sv3' }],
    availability: [av('u_t1', 1, '09:00', '12:00'), av('u_t1', 3, '13:00', '16:00'), av('u_t2', 2, '09:00', '11:30'), av('u_t2', 4, '09:00', '11:30'), av('u_t3', 1, '10:00', '12:00'), av('u_t3', 5, '13:00', '15:00')],
    appointments: [],
    appointment_history: [],
  };
  saveDb(db);
  return db;
}
