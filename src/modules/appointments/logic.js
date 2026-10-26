// Small display helpers shared by the appointment screens.
// The rules themselves (open slots, double-booking, who may change a status) are enforced by the server.
import { ACTIVE, ymd } from '../../lib/utils.js';

export function dayLabel(date) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date === ymd(new Date())) return 'Today';
  if (date === ymd(tomorrow)) return 'Tomorrow';
  return new Date(date + 'T00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export const fullDate = (d) => new Date(d + 'T00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
export const longDate = (d) => new Date(d + 'T00:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });

// Active appointments first (soonest first), then the rest (newest first)
export function sortAppointments(a, b) {
  const aActive = ACTIVE.includes(a.status);
  const bActive = ACTIVE.includes(b.status);
  if (aActive !== bActive) return aActive ? -1 : 1;
  const x = a.date + a.time;
  const y = b.date + b.time;
  return aActive ? x.localeCompare(y) : y.localeCompare(x);
}
