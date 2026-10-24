import { useApp } from '../../context.jsx';
import Icon from '../../components/Icons.jsx';
import Avatar from '../../components/Avatar.jsx';
import StatusPill from '../../components/StatusPill.jsx';
import { ACTIVE, f12, nm, sv, ymd } from '../../lib/utils.js';
import { fullDate } from './logic.js';

export default function StaffDashboard() {
  const { db, me, go } = useApp();
  const mine = db.appointments.filter((a) => a.staff_id === me.id);
  const now = new Date();
  const today = ymd(now);
  const in14Days = new Date();
  in14Days.setDate(in14Days.getDate() + 14);

  const pending = mine.filter((a) => a.status === 'pending').sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const todays = mine
    .filter((a) => a.date === today && ['pending', 'approved', 'completed'].includes(a.status))
    .sort((a, b) => a.time.localeCompare(b.time));
  const upcoming = mine.filter((a) => ACTIVE.includes(a.status) && a.date >= today && a.date <= ymd(in14Days));
  const newToday = pending.filter((a) => ymd(new Date(a.created_at)) === today).length;
  const nowTime = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  const nextToday = todays.find((a) => a.status === 'approved' && a.time >= nowTime);

  const cards = [
    ['Pending requests', pending.length, newToday + ' new today', 'inbox', 'amber'],
    ['Today’s appointments', todays.length, nextToday ? 'Next at ' + f12(nextToday.time) : 'Nothing more today', 'calendar', 'blue'],
    ['Upcoming', upcoming.length, 'Next 14 days', 'clock', 'teal'],
    ['Completed', mine.filter((a) => a.status === 'completed').length, 'All time', 'calendarCheck', 'green'],
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Welcome back, {me.name.replace(/^(Dr|Mr|Ms|Mrs|Prof)\.?\s+/i, '').split(' ')[0]}</h1>
          <p className="page-subtitle">Here’s what needs your attention today.</p>
        </div>
        <button className="button button-primary button-large" onClick={() => go('schedule')}>
          <Icon name="calendar" size={18} /> Manage schedule
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

      <div className="dashboard-columns">
        <div className="card">
          <div className="panel-header">
            <div>
              <h2>Today’s schedule</h2>
              <p className="text-muted text-small">{now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
            </div>
            <button className="link-button" onClick={() => go('schedule')}>View full schedule <Icon name="arrow" size={16} /></button>
          </div>
          {todays.length === 0 && <p className="text-muted">No appointments today.</p>}
          {todays.map((a) => (
            <div className="timeline-row" key={a.id}>
              <span className="text-muted text-small">{f12(a.time)}</span>
              <div>
                <b>{nm(db, a.student_id)}</b>
                <div className="text-muted text-small">{sv(db, a.service_id)}</div>
              </div>
              <StatusPill status={a.status} />
            </div>
          ))}
        </div>

        <div className="card">
          <div className="panel-header">
            <div>
              <h2>Pending requests</h2>
              <p className="text-muted text-small">Review student requests</p>
            </div>
            <span className="count-pill">{pending.length}</span>
          </div>
          {pending.length === 0 && <p className="text-muted">No requests waiting on you.</p>}
          {pending.slice(0, 3).map((a) => (
            <button className="request-item" key={a.id} onClick={() => go('requests')}>
              <Avatar name={nm(db, a.student_id)} small />
              <span className="item-main">
                <b>{nm(db, a.student_id)}</b>
                <span className="text-muted text-small">{sv(db, a.service_id)}</span>
                <span className="text-muted text-small">{fullDate(a.date)} · {f12(a.time)}</span>
              </span>
              <Icon name="chevronRight" size={18} />
            </button>
          ))}
          <button className="button review-all" onClick={() => go('requests')}>Review all requests</button>
        </div>
      </div>
    </>
  );
}
