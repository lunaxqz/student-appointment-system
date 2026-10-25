import { useState } from 'react';
import { useApp } from '../../context.jsx';
import Icon from '../../components/Icons.jsx';
import Avatar from '../../components/Avatar.jsx';
import StatusPill from '../../components/StatusPill.jsx';
import { ACTIVE, f12, nm, sv, ymd } from '../../lib/utils.js';
import { changeStatus, refOf } from './logic.js';

const PAGE_SIZE = 5;

const TABS = {
  mine: [['all', 'All'], ['upcoming', 'Upcoming'], ['pending', 'Pending'], ['approved', 'Approved'], ['cancelled', 'Cancelled']],
  history: [['all', 'All'], ['completed', 'Completed'], ['rejected', 'Rejected'], ['cancelled', 'Cancelled']],
};
const HEADINGS = {
  mine: ['My Appointments', 'Track upcoming appointments and pending requests.'],
  history: ['Appointment History', 'Review past appointments and status changes.'],
};

const fullDate = (d) => new Date(d + 'T00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

// Active appointments first (soonest first), then the rest (newest first)
function order(a, b) {
  const aActive = ACTIVE.includes(a.status);
  const bActive = ACTIVE.includes(b.status);
  if (aActive !== bActive) return aActive ? -1 : 1;
  const x = a.date + a.time;
  const y = b.date + b.time;
  return aActive ? x.localeCompare(y) : y.localeCompare(x);
}

// mode: 'mine' (everything) or 'history' (completed, rejected, cancelled)
export default function StudentAppointments({ mode }) {
  const { db, me, commit, toast } = useApp();
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');
  const [service, setService] = useState('');
  const [page, setPage] = useState(1);
  const today = ymd(new Date());

  const base = db.appointments.filter((a) => a.student_id === me.id && (mode === 'mine' || !ACTIVE.includes(a.status)));
  const matchesTab = (a) => tab === 'all'
    || (tab === 'upcoming' ? ACTIVE.includes(a.status) && a.date >= today : a.status === tab);
  const matchesFilters = (a) => (!service || a.service_id === service)
    && (nm(db, a.staff_id) + sv(db, a.service_id) + refOf(a.id)).toLowerCase().includes(query.toLowerCase());

  const list = base.filter((a) => matchesTab(a) && matchesFilters(a)).sort(order);
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const rows = list.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const filterChange = (setter) => (value) => { setter(value); setPage(1); };
  const clearFilters = () => { setQuery(''); setService(''); setTab('all'); setPage(1); };
  const cancel = (a) => { changeStatus(commit, me, a, 'cancelled'); toast('Appointment cancelled.'); };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{HEADINGS[mode][0]}</h1>
          <p className="page-subtitle">{HEADINGS[mode][1]}</p>
        </div>
      </div>

      <div className="tabs">
        {TABS[mode].map(([key, label]) => (
          <button key={key} className={'tab' + (tab === key ? ' active' : '')} onClick={() => filterChange(setTab)(key)}>
            {label}{key === 'all' && <span className="tab-count">{base.length}</span>}
          </button>
        ))}
      </div>

      <div className="toolbar card">
        <div className="search-field">
          <Icon name="search" size={18} />
          <input placeholder="Search appointments…" value={query} onChange={(e) => filterChange(setQuery)(e.target.value)} />
        </div>
        <select value={service} onChange={(e) => filterChange(setService)(e.target.value)}>
          <option value="">All services</option>
          {db.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button className="button" onClick={clearFilters}>Clear filters</button>
      </div>

      <div className="card table-card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Faculty</th><th>Service</th><th>Date & time</th><th>Status</th><th>Reference</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const log = db.appointment_history.filter((h) => h.appointment_id === a.id);
                return (
                  <tr key={a.id}>
                    <td><div className="person-cell"><Avatar name={nm(db, a.staff_id)} small /> {nm(db, a.staff_id)}</div></td>
                    <td>{sv(db, a.service_id)}</td>
                    <td><b>{fullDate(a.date)}</b><div className="text-muted text-small">{f12(a.time)}</div></td>
                    <td><StatusPill status={a.status} /></td>
                    <td className="text-muted">{refOf(a.id)}</td>
                    <td>
                      {ACTIVE.includes(a.status) && <button className="button button-small button-danger" onClick={() => cancel(a)}>Cancel</button>}
                      <details>
                        <summary className="text-small text-muted">Timeline</summary>
                        {log.map((h) => <div className="timeline-entry" key={h.id}>{new Date(h.at).toLocaleString()}: {h.status} by {h.by}</div>)}
                      </details>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!rows.length && <p className="text-muted empty-state">No appointments match. Try clearing the filters.</p>}

        <div className="table-footer">
          <span className="text-muted text-small">
            Showing {list.length ? (current - 1) * PAGE_SIZE + 1 : 0}–{(current - 1) * PAGE_SIZE + rows.length} of {list.length} appointments
          </span>
          <div className="pager">
            <button className="page-button" disabled={current === 1} onClick={() => setPage(current - 1)}>Previous</button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button key={i} className={'page-button' + (current === i + 1 ? ' active' : '')} onClick={() => setPage(i + 1)}>{i + 1}</button>
            ))}
            <button className="page-button" disabled={current === totalPages} onClick={() => setPage(current + 1)}>Next</button>
          </div>
        </div>
      </div>
    </>
  );
}
