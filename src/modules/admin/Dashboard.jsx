import { useApp } from '../../context.jsx';
import Icon from '../../components/Icons.jsx';
import Avatar from '../../components/Avatar.jsx';
import StatusPill from '../../components/StatusPill.jsx';
import { f12, nm, sv } from '../../lib/utils.js';
import { fullDate } from '../appointments/logic.js';

const STATUSES = ['approved', 'completed', 'pending', 'cancelled', 'rejected'];

export default function Dashboard() {
  const { db, go } = useApp();
  const count = (status) => db.appointments.filter((a) => a.status === status).length;
  const staff = db.users.filter((u) => u.role === 'staff');
  const biggest = Math.max(1, ...STATUSES.map(count));
  const recent = db.appointments.slice().sort((a, b) => b.created_at - a.created_at).slice(0, 5);

  const cards = [
    ['Total users', db.users.length, db.users.filter((u) => u.role === 'student').length + ' students', 'users', 'blue'],
    ['Faculty members', staff.length, staff.filter((u) => u.active).length + ' currently active', 'userPlus', 'teal'],
    ['Total appointments', db.appointments.length, 'All time', 'calendar', 'green'],
    ['Pending requests', count('pending'), 'Across all faculty', 'clock', 'amber'],
  ];
  const quickActions = [
    ['users', 'Manage Users', 'Review accounts and access', 'users'],
    ['staff', 'Manage Staff', 'Assign services and profiles', 'userPlus'],
    ['appts', 'View Appointments', 'Monitor appointment records', 'calendarCheck'],
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Administration Dashboard</h1>
          <p className="page-subtitle">A clear overview of university appointment activity.</p>
        </div>
        <button className="button button-primary button-large" onClick={() => go('users')}>
          <Icon name="plus" size={18} /> Add user
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
            <div><h2>Appointment overview</h2><p className="text-muted text-small">All appointments by status</p></div>
          </div>
          <div className="bar-list">
            {STATUSES.map((s) => (
              <div className="bar-row" key={s}>
                <span className="text-muted">{s[0].toUpperCase() + s.slice(1)}</span>
                <span className="bar-track"><span className={'bar-fill bar-' + s} style={{ width: (count(s) / biggest) * 100 + '%' }} /></span>
                <span className="bar-value">{count(s)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="panel-header">
            <div><h2>Quick actions</h2><p className="text-muted text-small">Common administrative tasks</p></div>
          </div>
          {quickActions.map(([page, title, note, icon]) => (
            <button className="quick-action" key={page} onClick={() => go(page)}>
              <span className="choice-icon"><Icon name={icon} /></span>
              <span className="item-main"><b>{title}</b><span className="text-muted text-small" style={{ display: 'block' }}>{note}</span></span>
              <Icon name="chevronRight" size={18} />
            </button>
          ))}
        </div>
      </div>

      <div className="card table-card" style={{ marginTop: 20 }}>
        <div className="panel-header" style={{ padding: '20px 22px 0' }}>
          <div><h2>Recent appointments</h2><p className="text-muted text-small">Latest activity across the portal</p></div>
          <button className="link-button" onClick={() => go('appts')}>View all <Icon name="arrow" size={16} /></button>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Student</th><th>Faculty</th><th>Service</th><th>Date & time</th><th>Status</th></tr></thead>
            <tbody>
              {recent.map((a) => (
                <tr key={a.id}>
                  <td><div className="person-cell"><Avatar name={nm(db, a.student_id)} small /> {nm(db, a.student_id)}</div></td>
                  <td>{nm(db, a.staff_id)}</td>
                  <td>{sv(db, a.service_id)}</td>
                  <td><b>{fullDate(a.date)}</b><div className="text-muted text-small">{f12(a.time)}</div></td>
                  <td><StatusPill status={a.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!recent.length && <p className="text-muted empty-state">No appointments yet.</p>}
      </div>
    </>
  );
}
