// One function per backend endpoint, so components never build URLs by hand.
import api from './api.js';

// Drops empty values so the server's validators never see `role=` or `q=`.
const clean = (params) => Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null));

export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }).then((r) => r.data), // { token, user }
  // body: { full_name, email, password, role: 'student' | 'staff', student_id?, course? } -> { token, user }
  register: (body) => api.post('/auth/register', body).then((r) => r.data),
  me: (signal) => api.get('/auth/me', { signal }).then((r) => r.data.user),
  changePassword: (current_password, new_password) => api.patch('/auth/password', { current_password, new_password }),
};

// Read-only lists that every signed-in user can see.
export const catalogApi = {
  services: (signal) => api.get('/services', { signal }).then((r) => r.data.items),                       // [{ id, name, facultyCount }]
  faculty: (params, signal) => api.get('/faculty', { params: clean(params || {}), signal }).then((r) => r.data.items), // [{ id, name, title, dept, bio, service_ids, weekdays, next_open }]
  // [{ date: 'YYYY-MM-DD', slots: [{ time: 'HH:MM', busy }] }] for the next `days` days (only days that have slots)
  slots: (staffId, serviceId, days, signal) => api.get(`/faculty/${staffId}/slots`, { params: clean({ service: serviceId, days }), signal }).then((r) => r.data.days),
};

// A faculty member's weekly availability (faculty: their own, admin: anyone's).
export const scheduleApi = {
  get: (staffId, from, to, signal) => api.get(`/staff/${staffId}/schedule`, { params: { from, to }, signal }).then((r) => r.data), // { blocks, services, appointments }
  addBlock: (body) => api.post('/availability', body).then((r) => r.data.block),   // { staff_id?, service_id, weekday, start, end }
  removeBlock: (id) => api.delete(`/availability/${id}`),
};

// Students and faculty: their own appointments.
export const appointmentApi = {
  list: (signal) => api.get('/appointments', { signal }).then((r) => r.data.items),
  book: (body) => api.post('/appointments', body).then((r) => r.data.appointment),  // { staff_id, service_id, date, time, reason }
  setStatus: (id, status, notes) => api.patch(`/appointments/${id}/status`, { status, notes }).then((r) => r.data.appointment),
};

export const adminApi = {
  dashboard: (signal) => api.get('/admin/dashboard', { signal }).then((r) => r.data),

  // params: { q, role, status, page, pageSize } -> { items, page, pageSize, total }
  listUsers: (params, signal) => api.get('/admin/users', { params: clean(params), signal }).then((r) => r.data),
  createUser: (body) => api.post('/admin/users', body).then((r) => r.data.user),
  // The server only accepts { role } and/or { is_active } here.
  updateUser: (id, changes) => api.patch(`/admin/users/${id}`, changes).then((r) => r.data.user),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),

  // params: { q, service, status, page, pageSize } -> { items, page, pageSize, total }
  listAppointments: (params, signal) => api.get('/admin/appointments', { params: clean(params), signal }).then((r) => r.data),
  setAppointmentStatus: (id, status) => api.patch(`/admin/appointments/${id}/status`, { status }).then((r) => r.data.appointment),

  staff: (signal) => api.get('/admin/staff', { signal }).then((r) => r.data.items),
  updateStaff: (id, profile) => api.patch(`/admin/staff/${id}`, profile).then((r) => r.data.staff),   // { title, dept, bio }
  setStaffServices: (id, serviceIds) => api.put(`/admin/staff/${id}/services`, { service_ids: serviceIds }).then((r) => r.data.staff),
  createService: (name) => api.post('/admin/services', { name }).then((r) => r.data.service),
  deleteService: (id) => api.delete(`/admin/services/${id}`),
};
