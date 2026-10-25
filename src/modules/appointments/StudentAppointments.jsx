import { useState } from 'react';
import { useApp } from '../../context.jsx';
import Icon from '../../components/Icons.jsx';
import Avatar from '../../components/Avatar.jsx';
import StatusPill from '../../components/StatusPill.jsx';
import LoadState from '../../components/LoadState.jsx';
import useLoad from '../../lib/useLoad.js';
import { appointmentApi, catalogApi } from '../../lib/endpoints.js';
import { errorMessage } from '../../lib/api.js';
import { ACTIVE, f12, ymd } from '../../lib/utils.js';
import { fullDate, sortAppointments } from './logic.js';

const PAGE_SIZE = 5;

const TABS = {
  mine: [['all', 'All'], ['upcoming', 'Upcoming'], ['pending', 'Pending'], ['approved', 'Approved'], ['cancelled', 'Cancelled']],
  history: [['all', 'All'], ['completed', 'Completed'], ['rejected', 'Rejected'], ['cancelled', 'Cancelled']],
};
const HEADINGS = {
  mine: ['My Appointments', 'Track upcoming appointments and pending requests.'],
  history: ['Appointment History', 'Review past appointments and status changes.'],
};

// mode: 'mine' (everything) or 'history' (completed, rejected, cancelled)
export default function StudentAppointments({ mode }) {
  const { toast } = useApp();
  const { data, loading, error, reload } = useLoad((signal) => Promise.all([appointmentApi.list(signal), catalogApi.services(signal)]), []);
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');
  const [service, setService] = useState('');
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState(null);
  const today = ymd(new Date());
  if (!data) return <div className="card"><LoadState loading={loading} error={error} onRetry={reload} loadingText="Loading appointments…" /></div>;
  const [appointments, services] = data;

  const base = appointments.filter((a) => mode === 'mine' || !ACTIVE.includes(a.status));
  const matchesTab = (a) => tab === 'all'
    || (tab === 'upcoming' ? ACTIVE.includes(a.status) && a.date >= today : a.status === tab);
  const matchesFilters = (a) => (!service || a.service.id === Number(service))
    && (a.staff.name + a.service.name + a.reference).toLowerCase().includes(query.toLowerCase());

  const list = base.filter((a) => matchesTab(a) && matchesFilters(a)).sort(sortAppointments);
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const rows = list.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const filterChange = (setter) => (value) => { setter(value); setPage(1); };
  const clearFilters = () => { setQuery(''); setService(''); setTab('all'); setPage(1); };
  const cancel = async (a) => {
    if (!window.confirm('Cancel this appointment?')) return;
    setBusyId(a.id);
    try {
      await appointmentApi.setStatus(a.id, 'cancelled');
      toast('Appointment cancelled.');
    } catch (err) {
      toast(errorMessage(err, 'Could not cancel the appointment.'));
    } finally {
      setBusyId(null);
      reload();
    }
  };

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
          {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
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
                return (
                  <tr key={a.id}>
                    <td><div className="person-cell"><Avatar name={a.staff.name} small /> {a.staff.name}</div></td>
                    <td>{a.service.name}</td>
                    <td><b>{fullDate(a.date)}</b><div className="text-muted text-small">{f12(a.time)}</div></td>
                    <td><StatusPill status={a.status} /></td>
                    <td className="text-muted">{a.reference}</td>
                    <td>
                      {ACTIVE.includes(a.status) && <button className="button button-small button-danger" disabled={busyId === a.id} onClick={() => cancel(a)}>Cancel</button>}
                      <details>
                        <summary className="text-small text-muted">Timeline</summary>
                        {a.history.map((h) => <div className="timeline-entry" key={h.id}>{new Date(h.at).toLocaleString()}: {h.status} by {h.by}</div>)}
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
