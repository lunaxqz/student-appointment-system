import { Fragment, useState } from 'react';
import { useApp } from '../../context.jsx';
import Icon from '../../components/Icons.jsx';
import Avatar from '../../components/Avatar.jsx';
import Pager from '../../components/Pager.jsx';
import { hashPassword } from '../auth/password.js';
import { sv, uid } from '../../lib/utils.js';
import { userCode } from '../admin/userCode.js';

const PAGE_SIZE = 6;
const EMPTY_FORM = { name: '', email: '', password: '', title: '', dept: '' };

// Admin: faculty profiles, the services offered, and which staff member offers what.
export default function ManageStaff() {
  const { db, commit, toast } = useApp();
  const [query, setQuery] = useState('');
  const [service, setService] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState('');
  const [newService, setNewService] = useState('');

  const serviceIdsOf = (id) => db.staff_services.filter((x) => x.staff_id === id).map((x) => x.service_id);
  const list = db.users
    .filter((u) => u.role === 'staff')
    .filter((u) => !service || serviceIdsOf(u.id).includes(service))
    .filter((u) => !status || (status === 'active') === u.active)
    .filter((u) => (u.name + u.email + u.title + u.dept).toLowerCase().includes(query.toLowerCase()));
  const rows = list.slice((Math.min(page, Math.ceil(list.length / PAGE_SIZE) || 1) - 1) * PAGE_SIZE).slice(0, PAGE_SIZE);

  const filtered = (setter) => (value) => { setter(value); setPage(1); };
  const clearFilters = () => { setQuery(''); setService(''); setStatus(''); setPage(1); };
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const edit = (id, key, value) => commit((d) => { d.users.find((u) => u.id === id)[key] = value; });

  const toggleService = (staffId, serviceId) => commit((d) => {
    const i = d.staff_services.findIndex((x) => x.staff_id === staffId && x.service_id === serviceId);
    i >= 0 ? d.staff_services.splice(i, 1) : d.staff_services.push({ staff_id: staffId, service_id: serviceId });
  });
  const removeService = (id) => commit((d) => {
    d.services = d.services.filter((x) => x.id !== id);
    d.staff_services = d.staff_services.filter((x) => x.service_id !== id);
  });
  const addService = () => {
    if (!newService.trim()) return;
    commit((d) => d.services.push({ id: uid('sv'), name: newService.trim() }));
    setNewService('');
  };

  const addStaff = async () => {
    const email = form.email.trim().toLowerCase();
    if (!form.name.trim() || !email.includes('@') || form.password.length < 6) return toast('Name, valid email and 6+ character password required.');
    if (db.users.some((u) => u.email === email)) return toast('Email already in use.');
    const password_hash = await hashPassword(form.password);
    commit((d) => d.users.push({ id: uid('u_'), name: form.name.trim(), email, password_hash, role: 'staff', active: true, title: form.title, dept: form.dept, bio: '' }));
    setForm(EMPTY_FORM); setAdding(false); toast('Staff member added.');
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
            <input placeholder="Full name" value={form.name} onChange={set('name')} />
            <input placeholder="Email" value={form.email} onChange={set('email')} />
            <input type="password" placeholder="Password (6+ characters)" value={form.password} onChange={set('password')} />
            <input placeholder="Title (e.g. Faculty Adviser)" value={form.title} onChange={set('title')} />
            <input placeholder="Office / department" value={form.dept} onChange={set('dept')} />
            <button className="button button-primary" onClick={addStaff}>Create staff</button>
            <button className="button" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="card">
        <h2>Services offered</h2>
        <div className="form-row">
          <input placeholder="New service name" value={newService} onChange={(e) => setNewService(e.target.value)} />
          <button className="button button-primary" onClick={addService}>Add service</button>
        </div>
        <div className="tag-list" style={{ marginTop: 12 }}>
          {db.services.map((s) => (
            <span className="tag" key={s.id}>{s.name} <button className="tag-remove" aria-label={'Remove ' + s.name} onClick={() => removeService(s.id)}>✕</button></span>
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
          {db.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
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
                    <td className="text-muted">{userCode(u)}</td>
                    <td><div className="person-cell"><Avatar name={u.name} small /> <span>{u.name}<span className="text-muted text-small" style={{ display: 'block', fontWeight: 400 }}>{u.title}</span></span></div></td>
                    <td>{u.email}</td>
                    <td><div className="tag-list">{serviceIdsOf(u.id).map((i) => <span className="tag" key={i}>{sv(db, i)}</span>)}</div></td>
                    <td><span className={'status-dot ' + (u.active ? 'dot-active' : 'dot-inactive')}>{u.active ? 'Active' : 'Inactive'}</span></td>
                    <td><button className="button button-small" onClick={() => setEditing(editing === u.id ? '' : u.id)}>{editing === u.id ? 'Close' : 'Edit'}</button></td>
                  </tr>
                  {editing === u.id && (
                    <tr className="edit-panel">
                      <td colSpan="6">
                        <div className="form-row">
                          <div><label>Title</label><input value={u.title} onChange={(e) => edit(u.id, 'title', e.target.value)} /></div>
                          <div><label>Office / department</label><input value={u.dept} onChange={(e) => edit(u.id, 'dept', e.target.value)} /></div>
                        </div>
                        <label>Bio</label>
                        <textarea rows="2" value={u.bio} onChange={(e) => edit(u.id, 'bio', e.target.value)} />
                        <label>Services this person offers</label>
                        <div className="chip-list">
                          {db.services.map((s) => (
                            <button key={s.id} className={'chip' + (serviceIdsOf(u.id).includes(s.id) ? ' active' : '')} onClick={() => toggleService(u.id, s.id)}>{s.name}</button>
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
