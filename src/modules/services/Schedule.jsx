import { useState } from 'react';
import { useApp } from '../../context.jsx';
import Icon from '../../components/Icons.jsx';
import LoadState from '../../components/LoadState.jsx';
import useLoad from '../../lib/useLoad.js';
import { scheduleApi } from '../../lib/endpoints.js';
import { errorMessage } from '../../lib/api.js';
import { DAYS, f12, tm, ymd } from '../../lib/utils.js';

const ROW_HEIGHT = 72; // pixels per hour in the weekly grid
const SHOWN_STATUSES = ['pending', 'approved', 'completed'];

const addDays = (date, n) => { const d = new Date(date); d.setDate(d.getDate() + n); return d; };
const mondayOf = (date) => { const d = new Date(date); d.setHours(0, 0, 0, 0); return addDays(d, -((d.getDay() + 6) % 7)); };
const monthDay = (d) => d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });

// Weekly calendar of one staff member's availability and booked appointments.
// Used for the faculty Schedule page and the admin Manage Schedules page.
// Anything passed as children is shown between the heading and the calendar.
export default function Schedule({ staffId, title, subtitle, children }) {
  const { toast } = useApp();
  const [weekStart, setWeekStart] = useState(mondayOf(new Date()));
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ weekday: 1, start: '09:00', end: '12:00', service_id: '' });

  // Availability repeats weekly; booked appointments are loaded for the week on screen.
  const { data, loading, error, reload } = useLoad(
    (signal) => scheduleApi.get(staffId, ymd(weekStart), ymd(addDays(weekStart, 6)), signal),
    [staffId, ymd(weekStart)]
  );
  if (!data) return <div className="card"><LoadState loading={loading} error={error} onRetry={reload} loadingText="Loading schedule…" /></div>;

  const availability = data.blocks;
  const offered = data.services; // services this person offers: every block belongs to one of them

  // Monday to Friday, plus Saturday/Sunday only when this person works those days
  const weekdays = [1, 2, 3, 4, 5, 6, 0].filter((w) => (w >= 1 && w <= 5) || availability.some((a) => a.weekday === w));
  const columns = weekdays.map((weekday) => ({ weekday, date: addDays(weekStart, (weekday + 6) % 7) }));

  // Grid hours: at least 8 AM to 5 PM, wider if someone is available earlier or later
  const startHour = Math.min(8, ...availability.map((a) => Math.floor(tm(a.start) / 60)));
  const endHour = Math.max(17, ...availability.map((a) => Math.ceil(tm(a.end) / 60)));
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);
  const positionOf = (start, end) => ({
    top: ((tm(start) - startHour * 60) / 60) * ROW_HEIGHT,
    height: ((tm(end) - tm(start)) / 60) * ROW_HEIGHT - 2,
  });
  const endTime = (time) => { const m = tm(time) + 30; return String(m / 60 | 0).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };

  const friday = addDays(weekStart, 4);
  const range = monthDay(weekStart) + '–' + (friday.getMonth() === weekStart.getMonth() ? friday.getDate() : monthDay(friday)) + ', ' + friday.getFullYear();
  const today = ymd(new Date());

  const serviceId = Number(form.service_id) || offered[0]?.id;
  const addBlock = async () => {
    const { weekday, start, end } = form;
    if (!serviceId) return toast('Assign a service to this person first (Manage Staff).');
    if (tm(end) - tm(start) < 30) return toast('End time must be at least 30 minutes after start.');
    if (availability.some((r) => r.weekday === +weekday && tm(start) < tm(r.end) && tm(end) > tm(r.start))) return toast('This overlaps an existing block.');
    setSaving(true);
    try {
      await scheduleApi.addBlock({ staff_id: staffId, service_id: serviceId, weekday: +weekday, start, end });
      setAdding(false);
      toast('Availability added.');
      reload();
    } catch (err) {
      toast(errorMessage(err, 'Could not add the availability.'));
    } finally {
      setSaving(false);
    }
  };
  const removeBlock = async (id) => {
    try {
      await scheduleApi.removeBlock(id);
      reload();
    } catch (err) {
      toast(errorMessage(err, 'Could not remove the availability.'));
    }
  };
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{title}</h1>
          <p className="page-subtitle">{subtitle}</p>
        </div>
        <button className="button button-primary button-large" onClick={() => setAdding(!adding)}>
          <Icon name="plus" size={18} /> Add availability
        </button>
      </div>

      {children}

      {adding && (
        <div className="card">
          <h2>New availability block</h2>
          <div className="form-row">
            <div><label>Day</label><select value={form.weekday} onChange={set('weekday')}>{DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}</select></div>
            <div><label>From</label><input type="time" value={form.start} onChange={set('start')} /></div>
            <div><label>To</label><input type="time" value={form.end} onChange={set('end')} /></div>
            <div><label>Service</label><select value={serviceId || ''} onChange={set('service_id')}>{offered.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
            <button className="button button-primary" onClick={addBlock} disabled={saving || !offered.length} style={{ alignSelf: 'flex-end' }}>{saving ? 'Adding…' : 'Add block'}</button>
            <button className="button" onClick={() => setAdding(false)} style={{ alignSelf: 'flex-end' }}>Cancel</button>
          </div>
          {!offered.length && <p className="error-text">No services assigned yet. An administrator can assign them under Manage Staff.</p>}
          <p className="text-muted text-small" style={{ marginTop: 8 }}>Blocks repeat every week and are split into 30-minute slots students can book.</p>
        </div>
      )}

      <div className="card week-card">
        <div className="week-toolbar">
          <button className="button" onClick={() => setWeekStart(mondayOf(new Date()))}>Today</button>
          <button className="button" aria-label="Previous week" onClick={() => setWeekStart(addDays(weekStart, -7))}><Icon name="chevronLeft" size={16} /></button>
          <button className="button" aria-label="Next week" onClick={() => setWeekStart(addDays(weekStart, 7))}><Icon name="chevronRight" size={16} /></button>
          <b className="week-range">{range}</b>
          <div className="week-legend">
            <span className="legend-available">Available</span>
            <span className="legend-booked">Booked</span>
            <span className="legend-pending">Pending</span>
          </div>
        </div>

        <div className="week-scroll">
          <div className="week-grid" style={{ gridTemplateColumns: '64px repeat(' + columns.length + ', 1fr)', '--row-height': ROW_HEIGHT + 'px' }}>
            <div className="week-corner" />
            {columns.map(({ weekday, date }) => (
              <div key={weekday} className={'week-day-head' + (ymd(date) === today ? ' today' : '')}>
                {DAYS[weekday].slice(0, 3).toUpperCase()} <b>{date.getDate()}</b>
              </div>
            ))}

            <div className="week-hours" style={{ height: (hours.length - 1) * ROW_HEIGHT }}>
              {hours.slice(0, -1).map((h) => (
                <span key={h} style={{ top: (h - startHour) * ROW_HEIGHT }}>{f12(String(h).padStart(2, '0') + ':00')}</span>
              ))}
            </div>

            {columns.map(({ weekday, date }) => (
              <div className="week-column" key={weekday} style={{ height: (hours.length - 1) * ROW_HEIGHT }}>
                {availability.filter((a) => a.weekday === weekday).map((a) => (
                  <div key={a.id} className="week-block block-available" style={positionOf(a.start, a.end)}>
                    <b>Available</b>
                    {f12(a.start)} – {f12(a.end)} · {a.service_name}
                    <button className="block-remove" aria-label="Remove availability" onClick={() => removeBlock(a.id)}>✕</button>
                  </div>
                ))}
                {data.appointments
                  .filter((a) => a.date === ymd(date) && SHOWN_STATUSES.includes(a.status))
                  .map((a) => (
                    <div key={a.id} className={'week-block ' + (a.status === 'pending' ? 'block-pending' : 'block-booked')} style={positionOf(a.time, endTime(a.time))}>
                      <b>{a.student.name}</b>
                      {f12(a.time)} · {a.service.name}
                    </div>
                  ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      {availability.length === 0 && <p className="text-muted">No availability yet. Add a block so students can book.</p>}
    </>
  );
}
