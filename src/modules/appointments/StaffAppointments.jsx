import { useState } from 'react';
import { useApp } from '../../context.jsx';
import Icon from '../../components/Icons.jsx';
import Avatar from '../../components/Avatar.jsx';
import Pager from '../../components/Pager.jsx';
import StatusPill from '../../components/StatusPill.jsx';
import { ACTIVE, f12, nm, sv } from '../../lib/utils.js';
import { changeStatus, conflictOnApprove, fullDate, refOf, sortAppointments } from './logic.js';

const PAGE_SIZE = 6;

const MODES = {
  requests: {
    title: 'Appointment Requests',
    subtitle: 'Review and respond to incoming student requests.',
    tabs: [['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['all', 'All']],
    firstTab: 'pending',
  },
  history: {
    title: 'Appointment History',
    subtitle: 'Review past appointments and status changes.',
    tabs: [['all', 'All'], ['completed', 'Completed'], ['rejected', 'Rejected'], ['cancelled', 'Cancelled']],
    firstTab: 'all',
  },
};

// mode: 'requests' (everything, answer pending ones) or 'history' (completed, rejected, cancelled)
export default function StaffAppointments({ mode }) {
  const { db, me, commit, toast } = useApp();
  const config = MODES[mode];
  const [tab, setTab] = useState(config.firstTab);
  const [query, setQuery] = useState('');
  const [service, setService] = useState('');
  const [page, setPage] = useState(1);

  const base = db.appointments.filter((a) => a.staff_id === me.id && (mode === 'requests' || !ACTIVE.includes(a.status)));
  const list = base
    .filter((a) => tab === 'all' || a.status === tab)
    .filter((a) => !service || a.service_id === service)
    .filter((a) => (nm(db, a.student_id) + sv(db, a.service_id) + refOf(a.id)).toLowerCase().includes(query.toLowerCase()))
    .sort(sortAppointments);
  const rows = list.slice((Math.min(page, Math.ceil(list.length / PAGE_SIZE) || 1) - 1) * PAGE_SIZE).slice(0, PAGE_SIZE);
  const firstTabCount = base.filter((a) => config.tabs[0][0] === 'all' || a.status === config.tabs[0][0]).length;

  const filtered = (setter) => (value) => { setter(value); setPage(1); };
  const clearFilters = () => { setQuery(''); setService(''); setTab(config.firstTab); setPage(1); };

  const act = (a, status) => {
    if (status === 'approved' && conflictOnApprove(db, a)) return toast('Another appointment already holds this slot.');
    changeStatus(commit, me, a, status);
    toast('Appointment ' + status + '.');
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{config.title}</h1>
          <p className="page-subtitle">{config.subtitle}</p>
        </div>
      </div>

      <div className="tabs">
        {config.tabs.map(([key, label], i) => (
          <button key={key} className={'tab' + (tab === key ? ' active' : '')} onClick={() => filtered(setTab)(key)}>
            {label}{i === 0 && <span className="tab-count">{firstTabCount}</span>}
          </button>
        ))}
      </div>

      <div className="toolbar card">
        <div className="search-field">
          <Icon name="search" size={18} />
          <input placeholder="Search by student or service…" value={query} onChange={(e) => filtered(setQuery)(e.target.value)} />
        </div>
        <select value={service} onChange={(e) => filtered(setService)(e.target.value)}>
          <option value="">All services</option>
          {db.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button className="button" onClick={clearFilters}>Clear filters</button>
      </div>

      <div className="card table-card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Student</th><th>Service</th><th>Requested date</th><th>Time</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const log = db.appointment_history.filter((h) => h.appointment_id === a.id);
                return (
                  <tr key={a.id}>
                    <td><div className="person-cell"><Avatar name={nm(db, a.student_id)} small /> {nm(db, a.student_id)}</div></td>
                    <td>{sv(db, a.service_id)}{a.reason && <div className="text-muted text-small">“{a.reason}”</div>}</td>
                    <td>{fullDate(a.date)}</td>
                    <td>{f12(a.time)}</td>
                    <td>
                      <StatusPill status={a.status} />
                      <details>
                        <summary className="text-small text-muted">Timeline</summary>
                        {log.map((h) => <div className="timeline-entry" key={h.id}>{new Date(h.at).toLocaleString()}: {h.status} by {h.by}</div>)}
                      </details>
                    </td>
                    <td>
                      <div className="form-row" style={{ gap: 8 }}>
                        {a.status === 'pending' && <>
                          <button className="button button-small" onClick={() => act(a, 'rejected')}>Reject</button>
                          <button className="button button-small button-primary" onClick={() => act(a, 'approved')}>Approve</button>
                        </>}
                        {a.status === 'approved' && <>
                          <button className="button button-small button-danger" onClick={() => act(a, 'cancelled')}>Cancel</button>
                          <button className="button button-small button-primary" onClick={() => act(a, 'completed')}>Mark done</button>
                        </>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!rows.length && <p className="text-muted empty-state">Nothing here yet.</p>}
        <Pager page={page} totalItems={list.length} pageSize={PAGE_SIZE} onPage={setPage} noun="appointments" />
      </div>
    </>
  );
}
