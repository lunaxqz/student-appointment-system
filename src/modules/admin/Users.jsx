import { useState } from 'react';
import { useApp } from '../../context.jsx';
import Icon from '../../components/Icons.jsx';
import Avatar from '../../components/Avatar.jsx';
import Pager from '../../components/Pager.jsx';
import { hashPassword } from '../auth/password.js';
import { ACTIVE, uid } from '../../lib/utils.js';
import { userCode } from './userCode.js';

const PAGE_SIZE = 6;
const ROLE_LABEL = { student: 'Student', staff: 'Faculty', admin: 'Admin' };
const EMPTY_FORM = { name: '', email: '', password: '', role: 'student' };

export default function Users() {
  const { db, me, commit, toast } = useApp();
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [menuFor, setMenuFor] = useState('');

  const list = db.users
    .filter((u) => !role || u.role === role)
    .filter((u) => !status || (status === 'active') === u.active)
    .filter((u) => (u.name + u.email + userCode(u)).toLowerCase().includes(query.toLowerCase()));
  const rows = list.slice((Math.min(page, Math.ceil(list.length / PAGE_SIZE) || 1) - 1) * PAGE_SIZE).slice(0, PAGE_SIZE);

  const filtered = (setter) => (value) => { setter(value); setPage(1); };
  const clearFilters = () => { setQuery(''); setRole(''); setStatus(''); setPage(1); };
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const update = (id, change) => { commit((d) => Object.assign(d.users.find((u) => u.id === id), change)); setMenuFor(''); };

  const addUser = async () => {
    const email = form.email.trim().toLowerCase();
    if (!form.name.trim() || !email.includes('@') || form.password.length < 6) return toast('Name, valid email and 6+ character password required.');
    if (db.users.some((u) => u.email === email)) return toast('Email already in use.');
    const password_hash = await hashPassword(form.password);
    commit((d) => d.users.push({ id: uid('u_'), name: form.name.trim(), email, password_hash, role: form.role, active: true, title: '', dept: '', bio: '' }));
    setForm(EMPTY_FORM); setAdding(false); toast('User added.');
  };

  const removeUser = (u) => {
    setMenuFor('');
    if (db.appointments.some((a) => (a.student_id === u.id || a.staff_id === u.id) && ACTIVE.includes(a.status))) return toast('Cancel their active appointments first.');
    if (!window.confirm('Delete ' + u.name + '? This cannot be undone.')) return;
    commit((d) => {
      d.users = d.users.filter((x) => x.id !== u.id);
      d.availability = d.availability.filter((x) => x.staff_id !== u.id);
      d.staff_services = d.staff_services.filter((x) => x.staff_id !== u.id);
    });
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Manage Users</h1>
          <p className="page-subtitle">Create, review, and manage portal accounts.</p>
        </div>
        <button className="button button-primary button-large" onClick={() => setAdding(!adding)}><Icon name="plus" size={18} /> Add user</button>
      </div>

      {adding && (
        <div className="card">
          <h2>New user</h2>
          <div className="form-row">
            <input placeholder="Full name" value={form.name} onChange={set('name')} />
            <input placeholder="Email" value={form.email} onChange={set('email')} />
            <input type="password" placeholder="Password (6+ characters)" value={form.password} onChange={set('password')} />
            <select value={form.role} onChange={set('role')}><option value="student">Student</option><option value="staff">Faculty</option><option value="admin">Admin</option></select>
            <button className="button button-primary" onClick={addUser}>Create user</button>
            <button className="button" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="toolbar card">
        <div className="search-field">
          <Icon name="search" size={18} />
          <input placeholder="Search users…" value={query} onChange={(e) => filtered(setQuery)(e.target.value)} />
        </div>
        <select value={role} onChange={(e) => filtered(setRole)(e.target.value)}>
          <option value="">All roles</option><option value="student">Students</option><option value="staff">Faculty</option><option value="admin">Admins</option>
        </select>
        <select value={status} onChange={(e) => filtered(setStatus)(e.target.value)}>
          <option value="">Any status</option><option value="active">Active</option><option value="inactive">Inactive</option>
        </select>
        <button className="button" onClick={clearFilters}>Clear filters</button>
      </div>

      <div className="card table-card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>ID</th><th>Full name</th><th>Email</th><th>Role</th><th>Account status</th><th>Actions</th></tr></thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td className="text-muted">{userCode(u)}</td>
                  <td><div className="person-cell"><Avatar name={u.name} small /> {u.name}</div></td>
                  <td>{u.email}</td>
                  <td>{ROLE_LABEL[u.role]}</td>
                  <td><span className={'status-dot ' + (u.active ? 'dot-active' : 'dot-inactive')}>{u.active ? 'Active' : 'Inactive'}</span></td>
                  <td>
                    {u.id === me.id ? <span className="text-muted text-small">You</span> : (
                      <div className="row-menu-wrap">
                        <button className="menu-button" aria-label={'Actions for ' + u.name} onClick={() => setMenuFor(menuFor === u.id ? '' : u.id)}>•••</button>
                        {menuFor === u.id && (
                          <>
                            <button className="user-menu-backdrop" aria-label="Close menu" onClick={() => setMenuFor('')} />
                            <div className="row-menu">
                              {Object.keys(ROLE_LABEL).filter((r) => r !== u.role).map((r) => (
                                <button key={r} onClick={() => update(u.id, { role: r })}>Make {ROLE_LABEL[r]}</button>
                              ))}
                              <button onClick={() => update(u.id, { active: !u.active })}>{u.active ? 'Deactivate' : 'Activate'}</button>
                              <button className="danger" onClick={() => removeUser(u)}>Delete</button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && <p className="text-muted empty-state">No users match.</p>}
        <Pager page={page} totalItems={list.length} pageSize={PAGE_SIZE} onPage={setPage} noun="users" />
      </div>
    </>
  );
}
