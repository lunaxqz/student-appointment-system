import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../context.jsx';
import Icon from '../../components/Icons.jsx';
import Avatar from '../../components/Avatar.jsx';
import StatusPill from '../../components/StatusPill.jsx';
import LoadState from '../../components/LoadState.jsx';
import { adminApi } from '../../lib/endpoints.js';
import { errorMessage, isCanceled } from '../../lib/api.js';
import { dateText, timeText } from './format.js';

const STATUSES = ['approved', 'completed', 'pending', 'cancelled', 'rejected'];

export default function Dashboard() {
  const { go } = useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  // Statistics come from GET /api/admin/dashboard, which counts the real PostgreSQL rows.
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    adminApi.dashboard(controller.signal)
      .then((d) => { setData(d); setLoading(false); })
      .catch((err) => { if (isCanceled(err)) return; setError(errorMessage(err, 'Could not load the dashboard.')); setLoading(false); });
    return () => controller.abort();
  }, [attempt]);

  const quickActions = [
    ['users', 'Manage Users', 'Review accounts and access', 'users'],
    ['staff', 'Manage Staff', 'Assign services and schedules', 'userPlus'],
    ['appts', 'View Appointments', 'Monitor appointment records', 'calendarCheck'],
  ];

  const header = (
    <div className="page-header">
      <div>
        <h1>Administration Dashboard</h1>
        <p className="page-subtitle">A clear overview of university appointment activity.</p>
      </div>
      <button className="button button-primary button-large" onClick={() => go('users', 'add')}>
        <Icon name="plus" size={18} /> Add user
      </button>
    </div>
  );

  if (loading || error) {
    return (
      <>
        {header}
        <div className="card"><LoadState loading={loading} error={error} onRetry={retry} loadingText="Loading dashboard…" /></div>
      </>
    );
  }

  const { users, appointments, recentAppointments } = data;
  const counts = appointments.byStatus;
  const biggest = Math.max(1, ...STATUSES.map((s) => counts[s] || 0));

  const cards = [
    ['Total users', users.total.toLocaleString(), '+' + users.newThisMonth + ' this month', 'users', 'blue'],
    ['Faculty members', users.staff.toLocaleString(), users.activeStaff + ' currently active', 'userPlus', 'teal'],
    ['Total appointments', appointments.total.toLocaleString(), 'All time', 'calendar', 'green'],
    ['Pending requests', appointments.pending.toLocaleString(), 'Across all faculty', 'clock', 'amber'],
  ];

  return (
    <>
      {header}

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
          {appointments.total === 0 ? (
            <p className="text-muted empty-state">No appointments have been booked yet.</p>
          ) : (
            <div className="bar-list">
              {STATUSES.map((s) => (
                <div className="bar-row" key={s}>
                  <span className="text-muted">{s[0].toUpperCase() + s.slice(1)}</span>
                  <span className="bar-track"><span className={'bar-fill bar-' + s} style={{ width: ((counts[s] || 0) / biggest) * 100 + '%' }} /></span>
                  <span className="bar-value">{(counts[s] || 0).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
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
              {recentAppointments.map((a) => (
                <tr key={a.id}>
                  <td><div className="person-cell"><Avatar name={a.student.name} small /> {a.student.name}</div></td>
                  <td>{a.staff.name}</td>
                  <td>{a.service.name}</td>
                  <td><b>{dateText(a.date)}</b><div className="text-muted text-small">{timeText(a.date)}</div></td>
                  <td><StatusPill status={a.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!recentAppointments.length && <p className="text-muted empty-state">No appointments yet.</p>}
      </div>
    </>
  );
}
