import { useApp } from '../../context.jsx';
import Icon from '../../components/Icons.jsx';
import StatusPill from '../../components/StatusPill.jsx';
import { ACTIVE, f12, nm, sv, ymd } from '../../lib/utils.js';

const ACTIVITY = {
  pending: ['Request submitted', 'calendar', 'blue'],
  approved: ['Request approved', 'calendarCheck', 'green'],
  rejected: ['Request declined', 'clock', 'rose'],
  cancelled: ['Appointment cancelled', 'history', 'rose'],
  completed: ['Appointment completed', 'check', 'teal'],
};

const shortDate = (d) => new Date(d + 'T00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

function timeAgo(timestamp) {
  const minutes = Math.floor((Date.now() - timestamp) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return minutes + 'm ago';
  if (minutes < 1440) return Math.floor(minutes / 60) + 'h ago';
  return Math.floor(minutes / 1440) + 'd ago';
}

export default function StudentDashboard() {
  const { db, me, go } = useApp();
  const mine = db.appointments.filter((a) => a.student_id === me.id);
  const today = ymd(new Date());
  const count = (status) => mine.filter((a) => a.status === status).length;
  const upcoming = mine
    .filter((a) => ACTIVE.includes(a.status) && a.date >= today)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const cards = [
    ['Upcoming', upcoming.length, upcoming[0] ? 'Next on ' + shortDate(upcoming[0].date) : 'Nothing scheduled', 'calendar', 'blue'],
    ['Pending requests', count('pending'), 'Awaiting review', 'clock', 'amber'],
    ['Approved', count('approved'), 'Confirmed', 'calendarCheck', 'green'],
    ['Completed', count('completed'), 'All time', 'history', 'teal'],
  ];

  const myIds = new Set(mine.map((a) => a.id));
  const activity = db.appointment_history
    .filter((h) => myIds.has(h.appointment_id))
    .sort((a, b) => b.at - a.at)
    .slice(0, 4);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{greeting}, {me.name.split(' ')[0]}!</h1>
          <p className="page-subtitle">Here’s your appointment overview.</p>
        </div>
        <button className="button button-primary button-large" onClick={() => go('book')}>
          <Icon name="plus" size={18} /> Book an appointment
        </button>
      </div>

      <div className="stat-cards">
        {cards.map(([label, value, note, icon, tone]) => (
          <div className="stat-card" key={label}>
            <div className={'stat-icon tone-' + tone}><Icon name={icon} /></div>
            <div>
              <div className="text-muted text-small">{label}</div>
              <div className="stat-value">{value}</div>
              <div className="text-muted text-small">{note}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="banner">
        <div className="banner-icon"><Icon name="calendar" size={26} /></div>
        <div className="banner-text">
          <h2>Need to see a faculty member?</h2>
          <p>Find the right service, choose an available time, and submit your request.</p>
        </div>
        <button className="button button-light" onClick={() => go('find')}>Find faculty <Icon name="arrow" size={16} /></button>
      </div>

      <div className="dashboard-columns">
        <div className="card">
          <div className="panel-header">
            <div>
              <h2>Upcoming appointments</h2>
              <p className="text-muted text-small">Your next scheduled consultations</p>
            </div>
            <button className="link-button" onClick={() => go('mine')}>View all <Icon name="arrow" size={16} /></button>
          </div>
          {upcoming.length === 0 && <p className="text-muted">No upcoming appointments yet.</p>}
          {upcoming.slice(0, 4).map((a) => {
            const date = new Date(a.date + 'T00:00');
            return (
              <div className="appointment-item" key={a.id}>
                <div className="date-box">
                  <b>{date.getDate()}</b>
                  <span>{date.toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}</span>
                </div>
                <div className="item-main">
                  <b>{sv(db, a.service_id)}</b>
                  <div className="text-muted text-small">{nm(db, a.staff_id)}</div>
                </div>
                <span className="text-muted">{f12(a.time)}</span>
                <StatusPill status={a.status} />
              </div>
            );
          })}
        </div>

        <div className="card">
          <div className="panel-header">
            <div>
              <h2>Recent activity</h2>
              <p className="text-muted text-small">Latest appointment updates</p>
            </div>
          </div>
          {activity.length === 0 && <p className="text-muted">No activity yet.</p>}
          {activity.map((h) => {
            const [label, icon, tone] = ACTIVITY[h.status];
            const appointment = mine.find((a) => a.id === h.appointment_id);
            return (
              <div className="activity-item" key={h.id}>
                <div className={'activity-icon tone-' + tone}><Icon name={icon} size={18} /></div>
                <div>
                  <b>{label}</b>
                  <div className="text-muted text-small">{sv(db, appointment.service_id)} · {timeAgo(h.at)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
