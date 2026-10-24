// Scheduling rules: slot generation, double-booking prevention, status changes.
import { ACTIVE, hm, tm, uid, ymd } from '../../lib/utils.js';

export const taken = (db, staffId, date, time) =>
  db.appointments.some((a) => a.staff_id === staffId && a.date === date && a.time === time && ACTIVE.includes(a.status));

export function slots(db, staffId, date) {
  const wd = new Date(date + 'T00:00').getDay();
  const now = new Date();
  const out = new Set();
  db.availability.filter((a) => a.staff_id === staffId && a.weekday === wd).forEach((a) => {
    for (let t = tm(a.start); t + 30 <= tm(a.end); t += 30) out.add(hm(t));
  });
  return [...out].sort().map((t) => ({
    t,
    busy: taken(db, staffId, date, t) || (date === ymd(now) && t <= hm(now.getHours() * 60 + now.getMinutes())),
  }));
}

export const next14 = () => Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return ymd(d); });

export const availableDays = (db, staffId) =>
  next14().filter((d) => db.availability.some((a) => a.staff_id === staffId && a.weekday === new Date(d + 'T00:00').getDay()));

// Returns an error string, or null when the booking is allowed.
export function validateBooking(db, { studentId, staffId, serviceId, date, time }) {
  if (!staffId || !serviceId || !date || !time) return 'Choose staff, service, date and time.';
  if (taken(db, staffId, date, time)) return 'That slot was just taken. Pick another time.';
  if (db.appointments.some((a) => a.student_id === studentId && a.date === date && a.time === time && ACTIVE.includes(a.status)))
    return 'You already have an appointment at that time.';
  return null;
}

export function createAppointment(commit, me, b) {
  const id = uid('ap_');
  commit((d) => {
    d.appointments.push({ id, student_id: me.id, staff_id: b.staffId, service_id: b.serviceId, date: b.date, time: b.time, reason: b.reason, status: 'pending', created_at: Date.now() });
    d.appointment_history.push({ id: uid('h'), appointment_id: id, status: 'pending', by: me.name, at: Date.now() });
  });
  return id;
}

export function conflictOnApprove(db, a) {
  return db.appointments.some((x) => x.id !== a.id && x.staff_id === a.staff_id && x.date === a.date && x.time === a.time && x.status === 'approved');
}

export function changeStatus(commit, me, a, status) {
  commit((d) => {
    d.appointments.find((x) => x.id === a.id).status = status;
    d.appointment_history.push({ id: uid('h'), appointment_id: a.id, status, by: me.name + ' (' + me.role + ')', at: Date.now() });
  });
}

// Short reference shown to students, e.g. APT-4K2Z
export const refOf = (id) => 'APT-' + id.slice(-4).toUpperCase();

// First open slot in the next 14 days for a staff member, or null
export function nextOpenSlot(db, staffId) {
  for (const date of next14()) {
    const open = slots(db, staffId, date).find((s) => !s.busy);
    if (open) return { date, time: open.t };
  }
  return null;
}

export function dayLabel(date) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date === ymd(new Date())) return 'Today';
  if (date === ymd(tomorrow)) return 'Tomorrow';
  return new Date(date + 'T00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export const fullDate = (d) => new Date(d + 'T00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

// Active appointments first (soonest first), then the rest (newest first)
export function sortAppointments(a, b) {
  const aActive = ACTIVE.includes(a.status);
  const bActive = ACTIVE.includes(b.status);
  if (aActive !== bActive) return aActive ? -1 : 1;
  const x = a.date + a.time;
  const y = b.date + b.time;
  return aActive ? x.localeCompare(y) : y.localeCompare(x);
}
