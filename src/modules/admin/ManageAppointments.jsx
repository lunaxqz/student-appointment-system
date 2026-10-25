import { useEffect, useState } from 'react';
import { useApp } from '../../context.jsx';
import Icon from '../../components/Icons.jsx';
import Avatar from '../../components/Avatar.jsx';
import Pager from '../../components/Pager.jsx';
import StatusPill from '../../components/StatusPill.jsx';
import LoadState from '../../components/LoadState.jsx';
import useLoad from '../../lib/useLoad.js';
import { adminApi, catalogApi } from '../../lib/endpoints.js';
import { errorMessage } from '../../lib/api.js';
import { dateText, timeText } from './format.js';

const PAGE_SIZE = 6;
const STATUSES = ['pending', 'approved', 'completed', 'rejected', 'cancelled'];

// Searching, filtering and paging happen on the server (GET /api/admin/appointments).
export default function ManageAppointments() {
  const { toast } = useApp();
  const [query, setQuery] = useState('');     // what the admin is typing
  const [search, setSearch] = useState('');   // what is sent to the server (debounced)
  const [service, setService] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => { setSearch(query); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const services = useLoad((signal) => catalogApi.services(signal), []);
  const list = useLoad(
    (signal) => adminApi.listAppointments({ q: search.trim(), service, status, page, pageSize: PAGE_SIZE }, signal).then((res) => {
      // The last item on the last page was removed or filtered away: step back to the new last page.
      if (!res.items.length && res.total > 0 && page > 1) { setPage(Math.ceil(res.total / PAGE_SIZE)); return null; }
      return res;
    }),
    [search, service, status, page]
  );
  const result = list.data || { items: [], total: 0 };
  const rows = result.items;

  const filtered = (setter) => (value) => { setter(value); setPage(1); };
  const clearFilters = () => { setQuery(''); setSearch(''); setService(''); setStatus(''); setPage(1); };
  const act = async (a, next) => {
    setBusyId(a.id);
    try {
      await adminApi.setAppointmentStatus(a.id, next);
      toast('Appointment ' + next + '.');
    } catch (err) {
      toast(errorMessage(err, 'Could not update the appointment.'));
    } finally {
      setBusyId(null);
      list.reload();
    }
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
          <input placeholder="Search by ID, student, or faculty…" maxLength={100} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select value={service} onChange={(e) => filtered(setService)(e.target.value)}>
          <option value="">All services</option>
          {(services.data || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={status} onChange={(e) => filtered(setStatus)(e.target.value)}>
          <option value="">Any status</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
        </select>
        <button className="button" onClick={clearFilters}>Clear filters</button>
      </div>

      <div className="card table-card" aria-busy={list.loading}>
        <div className="panel-header" style={{ padding: '20px 22px 0' }}>
          <div><h2>Appointments</h2><p className="text-muted text-small">All appointment records</p></div>
        </div>
        {list.error ? (
          <LoadState error={list.error} onRetry={list.reload} />
        ) : (
          <>
            <div className="table-wrap" style={list.loading && rows.length ? { opacity: 0.6 } : undefined}>
              <table>
                <thead><tr><th>Reference</th><th>Student</th><th>Faculty</th><th>Service</th><th>Date & time</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {rows.map((a) => (
                    <tr key={a.id}>
                      <td className="text-muted">{a.reference}</td>
                      <td><div className="person-cell"><Avatar name={a.student.name} small /> {a.student.name}</div></td>
                      <td>{a.staff.name}</td>
                      <td>{a.service.name}</td>
                      <td><b>{dateText(a.date)}</b><div className="text-muted text-small">{timeText(a.date)}</div></td>
                      <td><StatusPill status={a.status} /></td>
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
                  ))}
                </tbody>
              </table>
            </div>
            {list.loading && !rows.length && <LoadState loading loadingText="Loading appointments…" />}
            {!list.loading && !rows.length && <p className="text-muted empty-state">No appointments match.</p>}
            <Pager page={page} totalItems={result.total} pageSize={PAGE_SIZE} onPage={setPage} noun="appointments" />
          </>
        )}
      </div>
    </>
  );
}
