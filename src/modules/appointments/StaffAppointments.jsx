import { useState } from 'react';
import { useApp } from '../../context.jsx';
import Icon from '../../components/Icons.jsx';
import Avatar from '../../components/Avatar.jsx';
import Pager from '../../components/Pager.jsx';
import StatusPill from '../../components/StatusPill.jsx';
import LoadState from '../../components/LoadState.jsx';
import useLoad from '../../lib/useLoad.js';
import { appointmentApi, catalogApi } from '../../lib/endpoints.js';
import { errorMessage } from '../../lib/api.js';
import { ACTIVE, f12 } from '../../lib/utils.js';
import { fullDate, sortAppointments } from './logic.js';

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
  const { toast } = useApp();
  const { data, loading, error, reload } = useLoad((signal) => Promise.all([appointmentApi.list(signal), catalogApi.services(signal)]), []);
  const [busyId, setBusyId] = useState(null);
  const config = MODES[mode];
  const [tab, setTab] = useState(config.firstTab);
  const [query, setQuery] = useState('');
  const [service, setService] = useState('');
  const [page, setPage] = useState(1);

  if (!data) return <div className="card"><LoadState loading={loading} error={error} onRetry={reload} loadingText="Loading appointments…" /></div>;
  const [appointments, services] = data;

  const base = appointments.filter((a) => mode === 'requests' || !ACTIVE.includes(a.status));
  const list = base
    .filter((a) => tab === 'all' || a.status === tab)
    .filter((a) => !service || a.service.id === Number(service))
    .filter((a) => (a.student.name + a.service.name + a.reference).toLowerCase().includes(query.toLowerCase()))
    .sort(sortAppointments);
  const rows = list.slice((Math.min(page, Math.ceil(list.length / PAGE_SIZE) || 1) - 1) * PAGE_SIZE).slice(0, PAGE_SIZE);
  const firstTabCount = base.filter((a) => config.tabs[0][0] === 'all' || a.status === config.tabs[0][0]).length;

  const filtered = (setter) => (value) => { setter(value); setPage(1); };
  const clearFilters = () => { setQuery(''); setService(''); setTab(config.firstTab); setPage(1); };

  const act = async (a, status) => {
    setBusyId(a.id);
    try {
      await appointmentApi.setStatus(a.id, status);
      toast('Appointment ' + status + '.');
    } catch (err) {
      toast(errorMessage(err, 'Could not update the appointment.'));
    } finally {
      setBusyId(null);
      reload();
    }
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
          {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
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
                return (
                  <tr key={a.id}>
                    <td><div className="person-cell"><Avatar name={a.student.name} small /> {a.student.name}</div></td>
                    <td>{a.service.name}{a.reason && <div className="text-muted text-small">“{a.reason}”</div>}</td>
                    <td>{fullDate(a.date)}</td>
                    <td>{f12(a.time)}</td>
                    <td>
                      <StatusPill status={a.status} />
                      <details>
                        <summary className="text-small text-muted">Timeline</summary>
                        {a.history.map((h) => <div className="timeline-entry" key={h.id}>{new Date(h.at).toLocaleString()}: {h.status} by {h.by}</div>)}
                      </details>
                    </td>
                    <td>
                      <div className="form-row" style={{ gap: 8 }}>
                        {a.status === 'pending' && <>
                          <button className="button button-small" disabled={busyId === a.id} onClick={() => act(a, 'rejected')}>Reject</button>
                          <button className="button button-small button-primary" disabled={busyId === a.id} onClick={() => act(a, 'approved')}>Approve</button>
                        </>}
                        {a.status === 'approved' && <>
                          <button className="button button-small button-danger" disabled={busyId === a.id} onClick={() => act(a, 'cancelled')}>Cancel</button>
                          <button className="button button-small button-primary" disabled={busyId === a.id} onClick={() => act(a, 'completed')}>Mark done</button>
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
