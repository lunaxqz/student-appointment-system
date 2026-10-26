import { Fragment, useState } from 'react';
import { useApp } from '../../context.jsx';
import Icon from '../../components/Icons.jsx';
import Avatar from '../../components/Avatar.jsx';
import Pager from '../../components/Pager.jsx';
import LoadState from '../../components/LoadState.jsx';
import useLoad from '../../lib/useLoad.js';
import { adminApi, catalogApi } from '../../lib/endpoints.js';
import { errorMessage } from '../../lib/api.js';
import { userCode } from '../admin/userCode.js';

const PAGE_SIZE = 6;
const EMPTY_FORM = { name: '', email: '', password: '', title: '', dept: '' };

// Admin: faculty profiles, the services offered, and which staff member offers what. Everything is saved in PostgreSQL.
export default function ManageStaff() {
  const { toast } = useApp();
  const { data, loading, error, reload } = useLoad((signal) => Promise.all([adminApi.staff(signal), catalogApi.services(signal)]), []);
  const [query, setQuery] = useState('');
  const [service, setService] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(null);   // id of the person whose panel is open
  const [draft, setDraft] = useState(null);       // their profile being edited: { title, dept, bio }
  const [newService, setNewService] = useState('');
  const [busy, setBusy] = useState(false);

  if (!data) return <div className="card"><LoadState loading={loading} error={error} onRetry={reload} loadingText="Loading staff…" /></div>;
  const [staff, services] = data;
  const serviceName = (id) => services.find((s) => s.id === id)?.name || '';

  const list = staff
    .filter((u) => !service || u.service_ids.includes(Number(service)))
    .filter((u) => !status || (status === 'active') === u.is_active)
    .filter((u) => (u.full_name + u.email + u.title + u.dept).toLowerCase().includes(query.toLowerCase()));
  const rows = list.slice((Math.min(page, Math.ceil(list.length / PAGE_SIZE) || 1) - 1) * PAGE_SIZE).slice(0, PAGE_SIZE);

  const filtered = (setter) => (value) => { setter(value); setPage(1); };
  const clearFilters = () => { setQuery(''); setService(''); setStatus(''); setPage(1); };
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  // Runs one request, then refreshes the lists. Errors from the server (e.g. a conflict) are shown as they are.
  const run = async (work, done, failed) => {
    setBusy(true);
    try {
      await work();
      if (done) toast(done);
      reload();
      return true;
    } catch (err) {
      toast(errorMessage(err, failed));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const openEditor = (u) => {
    if (editing === u.id) { setEditing(null); setDraft(null); return; }
    setEditing(u.id); setDraft({ title: u.title, dept: u.dept, bio: u.bio });
  };
  const saveProfile = (u) => run(() => adminApi.updateStaff(u.id, draft), 'Profile saved.', 'Could not save the profile.');

  const toggleService = (u, serviceId) => {
    const next = u.service_ids.includes(serviceId) ? u.service_ids.filter((x) => x !== serviceId) : [...u.service_ids, serviceId];
    return run(() => adminApi.setStaffServices(u.id, next), null, 'Could not change the services.');
  };
  const addService = async () => {
    const name = newService.trim();
    if (!name) return;
    if (await run(() => adminApi.createService(name), 'Service added.', 'Could not add the service.')) setNewService('');
  };
  const removeService = (s) => {
    if (!window.confirm('Remove the service "' + s.name + '"? Faculty will no longer offer it.')) return;
    return run(() => adminApi.deleteService(s.id), 'Service removed.', 'Could not remove the service.');
  };

  const addStaff = async () => {
    const email = form.email.trim().toLowerCase();
    if (!form.name.trim() || !email.includes('@') || form.password.length < 6) return toast('Name, valid email and 6+ character password required.');
    const ok = await run(
      () => adminApi.createUser({ full_name: form.name.trim(), email, password: form.password, role: 'staff', title: form.title.trim(), dept: form.dept.trim() }),
      'Staff member added.', 'Could not create the staff member.'
    );
    if (ok) { setForm(EMPTY_FORM); setAdding(false); setPage(1); }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Manage Staff</h1>
          <p className="page-subtitle">Manage faculty profiles, services, and availability.</p>
        </div>
        <button className="button button-primary button-large" onClick={() => setAdding(!adding)}><Icon name="plus" size={18} /> Add staff</button>
      </div>

      {adding && (
        <div className="card">
          <h2>New staff member</h2>
          <div className="form-row">
            <input placeholder="Full name" maxLength={100} value={form.name} onChange={set('name')} />
            <input type="email" placeholder="Email" maxLength={150} value={form.email} onChange={set('email')} />
            <input type="password" placeholder="Password (6+ characters)" maxLength={72} autoComplete="new-password" value={form.password} onChange={set('password')} />
            <input placeholder="Title (e.g. Faculty Adviser)" maxLength={100} value={form.title} onChange={set('title')} />
            <input placeholder="Office / department" maxLength={100} value={form.dept} onChange={set('dept')} />
            <button className="button button-primary" onClick={addStaff} disabled={busy}>Create staff</button>
            <button className="button" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="card">
        <h2>Services offered</h2>
        <div className="form-row">
          <input placeholder="New service name" maxLength={100} value={newService} onChange={(e) => setNewService(e.target.value)} />
          <button className="button button-primary" onClick={addService} disabled={busy}>Add service</button>
        </div>
        <div className="tag-list" style={{ marginTop: 12 }}>
          {services.map((s) => (
            <span className="tag" key={s.id}>{s.name} <button className="tag-remove" aria-label={'Remove ' + s.name} disabled={busy} onClick={() => removeService(s)}>✕</button></span>
          ))}
        </div>
      </div>

      <div className="toolbar card">
        <div className="search-field">
          <Icon name="search" size={18} />
          <input placeholder="Search staff…" value={query} onChange={(e) => filtered(setQuery)(e.target.value)} />
        </div>
        <select value={service} onChange={(e) => filtered(setService)(e.target.value)}>
          <option value="">All services</option>
          {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={status} onChange={(e) => filtered(setStatus)(e.target.value)}>
          <option value="">Any status</option><option value="active">Active</option><option value="inactive">Inactive</option>
        </select>
        <button className="button" onClick={clearFilters}>Clear filters</button>
      </div>

      <div className="card table-card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>ID</th><th>Full name</th><th>Email</th><th>Services</th><th>Account status</th><th>Actions</th></tr></thead>
            <tbody>
              {rows.map((u) => (
                <Fragment key={u.id}>
                  <tr>
                    <td className="text-muted">{userCode({ id: u.id, role: 'staff' })}</td>
                    <td><div className="person-cell"><Avatar name={u.full_name} small /> <span>{u.full_name}<span className="text-muted text-small" style={{ display: 'block', fontWeight: 400 }}>{u.title}</span></span></div></td>
                    <td>{u.email}</td>
                    <td><div className="tag-list">{u.service_ids.map((i) => <span className="tag" key={i}>{serviceName(i)}</span>)}</div></td>
                    <td><span className={'status-dot ' + (u.is_active ? 'dot-active' : 'dot-inactive')}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td><button className="button button-small" onClick={() => openEditor(u)}>{editing === u.id ? 'Close' : 'Edit'}</button></td>
                  </tr>
                  {editing === u.id && draft && (
                    <tr className="edit-panel">
                      <td colSpan="6">
                        <div className="form-row">
                          <div><label>Title</label><input maxLength={100} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></div>
                          <div><label>Office / department</label><input maxLength={100} value={draft.dept} onChange={(e) => setDraft({ ...draft, dept: e.target.value })} /></div>
                        </div>
                        <label>Bio</label>
                        <textarea rows="2" maxLength={1000} value={draft.bio} onChange={(e) => setDraft({ ...draft, bio: e.target.value })} />
                        <div style={{ marginTop: 10 }}><button className="button button-primary button-small" disabled={busy} onClick={() => saveProfile(u)}>Save profile</button></div>
                        <label>Services this person offers</label>
                        <div className="chip-list">
                          {services.map((s) => (
                            <button key={s.id} disabled={busy} className={'chip' + (u.service_ids.includes(s.id) ? ' active' : '')} onClick={() => toggleService(u, s.id)}>{s.name}</button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && <p className="text-muted empty-state">No staff match.</p>}
        <Pager page={page} totalItems={list.length} pageSize={PAGE_SIZE} onPage={setPage} noun="staff" />
      </div>
    </>
  );
}
