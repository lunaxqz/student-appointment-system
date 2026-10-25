import { useState } from 'react';
import { useApp } from '../../context.jsx';
import Icon from '../../components/Icons.jsx';
import Avatar from '../../components/Avatar.jsx';
import Pager from '../../components/Pager.jsx';
import StatusPill from '../../components/StatusPill.jsx';
import { f12, nm, sv } from '../../lib/utils.js';
import { changeStatus, conflictOnApprove, fullDate, refOf } from '../appointments/logic.js';

const PAGE_SIZE = 6;
const STATUSES = ['pending', 'approved', 'completed', 'rejected', 'cancelled'];

export default function ManageAppointments() {
  const { db, me, commit, toast } = useApp();
  const [query, setQuery] = useState('');
  const [service, setService] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const list = db.appointments
    .filter((a) => !service || a.service_id === service)
    .filter((a) => !status || a.status === status)
    .filter((a) => (refOf(a.id) + nm(db, a.student_id) + nm(db, a.staff_id)).toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  const rows = list.slice((Math.min(page, Math.ceil(list.length / PAGE_SIZE) || 1) - 1) * PAGE_SIZE).slice(0, PAGE_SIZE);

  const filtered = (setter) => (value) => { setter(value); setPage(1); };
  const clearFilters = () => { setQuery(''); setService(''); setStatus(''); setPage(1); };
  const act = (a, next) => {
    if (next === 'approved' && conflictOnApprove(db, a)) return toast('Another appointment already holds this slot.');
    changeStatus(commit, me, a, next);
    toast('Appointment ' + next + '.');
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Manage Appointments</h1>
          <p className="page-subtitle">Monitor, filter, and review appointment records across the portal.</p>
        </div>
      </div>

      <div className="toolbar card">
        <div className="search-field">
          <Icon name="search" size={18} />
          <input placeholder="Search by ID, student, or faculty…" value={query} onChange={(e) => filtered(setQuery)(e.target.value)} />
        </div>
        <select value={service} onChange={(e) => filtered(setService)(e.target.value)}>
          <option value="">All services</option>
          {db.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={status} onChange={(e) => filtered(setStatus)(e.target.value)}>
          <option value="">Any status</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
        </select>
        <button className="button" onClick={clearFilters}>Clear filters</button>
      </div>

      <div className="card table-card">
        <div className="panel-header" style={{ padding: '20px 22px 0' }}>
          <div><h2>Appointments</h2><p className="text-muted text-small">All appointment records</p></div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Reference</th><th>Student</th><th>Faculty</th><th>Service</th><th>Date & time</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td className="text-muted">{refOf(a.id)}</td>
                  <td><div className="person-cell"><Avatar name={nm(db, a.student_id)} small /> {nm(db, a.student_id)}</div></td>
                  <td>{nm(db, a.staff_id)}</td>
                  <td>{sv(db, a.service_id)}</td>
                  <td><b>{fullDate(a.date)}</b><div className="text-muted text-small">{f12(a.time)}</div></td>
                  <td><StatusPill status={a.status} /></td>
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
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && <p className="text-muted empty-state">No appointments match.</p>}
        <Pager page={page} totalItems={list.length} pageSize={PAGE_SIZE} onPage={setPage} noun="appointments" />
      </div>
    </>
  );
}
