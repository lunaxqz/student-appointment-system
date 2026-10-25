import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../context.jsx';
import Icon from '../../components/Icons.jsx';
import Avatar from '../../components/Avatar.jsx';
import Pager from '../../components/Pager.jsx';
import LoadState from '../../components/LoadState.jsx';
import { adminApi } from '../../lib/endpoints.js';
import { errorMessage, isCanceled } from '../../lib/api.js';
import { userCode } from './userCode.js';

const PAGE_SIZE = 10;
const ROLE_LABEL = { student: 'Student', staff: 'Faculty', admin: 'Admin' };
const EMPTY_FORM = { name: '', email: '', password: '', role: 'student' };

// Every list, search, create and change below goes to /api/admin/users and is saved in PostgreSQL.
// The server decides who may do what (admin only); hiding buttons here is just convenience.
export default function Users() {
  const { me, toast, intent } = useApp();
  const [query, setQuery] = useState('');     // what the admin is typing
  const [search, setSearch] = useState('');   // what is sent to the server (debounced)
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [adding, setAdding] = useState(intent === 'add');
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [menuFor, setMenuFor] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const refresh = useCallback(() => setAttempt((n) => n + 1), []);

  // Wait for a pause in typing before asking the server, and start again from page 1.
  useEffect(() => {
    const timer = setTimeout(() => { setSearch(query); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    adminApi.listUsers({ q: search.trim(), role, status, page, pageSize: PAGE_SIZE }, controller.signal)
      .then((res) => {
        // The last user on the last page was removed or filtered away: step back to the new last page.
        if (!res.items.length && res.total > 0 && page > 1) { setPage(Math.ceil(res.total / PAGE_SIZE)); return; }
        setResult({ items: res.items, total: res.total });
        setLoading(false);
      })
      .catch((err) => { if (isCanceled(err)) return; setError(errorMessage(err, 'Could not load users.')); setLoading(false); });
    return () => controller.abort();
  }, [search, role, status, page, attempt]);

  const rows = result.items;
  const filtersActive = Boolean(search.trim() || role || status);
  const filtered = (setter) => (value) => { setter(value); setPage(1); };
  const clearFilters = () => { setQuery(''); setSearch(''); setRole(''); setStatus(''); setPage(1); };
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const addUser = async () => {
    const full_name = form.name.trim();
    const email = form.email.trim().toLowerCase();
    // Quick checks for a faster response; the server validates everything again.
    if (!full_name || !email.includes('@') || form.password.length < 6) return setFormError('Name, valid email and 6+ character password required.');
    setSaving(true); setFormError('');
    try {
      await adminApi.createUser({ full_name, email, password: form.password, role: form.role });
      setForm(EMPTY_FORM); setAdding(false); setPage(1); refresh(); toast('User added.');
    } catch (err) {
      setFormError(errorMessage(err, 'Could not create the user.'));
    } finally {
      setSaving(false);
    }
  };

  // Role change or activate/deactivate. The server only accepts { role } and/or { is_active }.
  const changeUser = async (u, changes, done) => {
    setMenuFor(null); setBusyId(u.id);
    try {
      await adminApi.updateUser(u.id, changes);
      toast(done); refresh();
    } catch (err) {
      toast(errorMessage(err, 'Could not update the user.'));
    } finally {
      setBusyId(null);
    }
  };

  const removeUser = async (u) => {
    setMenuFor(null);
    if (!window.confirm('Delete ' + u.full_name + '? This cannot be undone.')) return;
    setBusyId(u.id);
    try {
      await adminApi.deleteUser(u.id);
      toast('User deleted.'); refresh();
    } catch (err) {
      // For example 409: users who appear in appointment records can only be deactivated.
      toast(errorMessage(err, 'Could not delete the user.'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Manage Users</h1>
          <p className="page-subtitle">Create, review, and manage portal accounts.</p>
        </div>
        <button className="button button-primary button-large" onClick={() => { setAdding(!adding); setFormError(''); }}><Icon name="plus" size={18} /> Add user</button>
      </div>

      {adding && (
        <div className="card">
          <h2>New user</h2>
          <div className="form-row">
            <input placeholder="Full name" maxLength={100} value={form.name} onChange={set('name')} />
            <input type="email" placeholder="Email" maxLength={150} value={form.email} onChange={set('email')} />
            <input type="password" placeholder="Password (6+ characters)" maxLength={72} autoComplete="new-password" value={form.password} onChange={set('password')} />
            <select value={form.role} onChange={set('role')}><option value="student">Student</option><option value="staff">Faculty</option><option value="admin">Admin</option></select>
            <button className="button button-primary" onClick={addUser} disabled={saving}>{saving ? 'Creating…' : 'Create user'}</button>
            <button className="button" onClick={() => { setAdding(false); setFormError(''); }} disabled={saving}>Cancel</button>
          </div>
          {formError && <div className="error-text" role="alert">{formError}</div>}
        </div>
      )}

      <div className="toolbar card">
        <div className="search-field">
          <Icon name="search" size={18} />
          <input placeholder="Search by name or email…" maxLength={100} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select value={role} onChange={(e) => filtered(setRole)(e.target.value)}>
          <option value="">All roles</option><option value="student">Students</option><option value="staff">Faculty</option><option value="admin">Admins</option>
        </select>
        <select value={status} onChange={(e) => filtered(setStatus)(e.target.value)}>
          <option value="">Any status</option><option value="active">Active</option><option value="inactive">Inactive</option>
        </select>
        <button className="button" onClick={clearFilters}>Clear filters</button>
      </div>

      <div className="card table-card" aria-busy={loading}>
        {error ? (
          <LoadState error={error} onRetry={refresh} />
        ) : (
          <>
            <div className="table-wrap" style={loading && rows.length ? { opacity: 0.6 } : undefined}>
              <table>
                <thead><tr><th>ID</th><th>Full name</th><th>Email</th><th>Role</th><th>Account status</th><th>Actions</th></tr></thead>
                <tbody>
                  {rows.map((u) => (
                    <tr key={u.id}>
                      <td className="text-muted">{userCode(u)}</td>
                      <td><div className="person-cell"><Avatar name={u.full_name} small /> {u.full_name}</div></td>
                      <td>{u.email}</td>
                      <td>{ROLE_LABEL[u.role]}</td>
                      <td><span className={'status-dot ' + (u.is_active ? 'dot-active' : 'dot-inactive')}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
                      <td>
                        {u.id === me.id ? <span className="text-muted text-small">You</span> : (
                          <div className="row-menu-wrap">
                            <button className="menu-button" aria-label={'Actions for ' + u.full_name} disabled={busyId === u.id} onClick={() => setMenuFor(menuFor === u.id ? null : u.id)}>•••</button>
                            {menuFor === u.id && (
                              <>
                                <button className="user-menu-backdrop" aria-label="Close menu" onClick={() => setMenuFor(null)} />
                                <div className="row-menu">
                                  {Object.keys(ROLE_LABEL).filter((r) => r !== u.role).map((r) => (
                                    <button key={r} onClick={() => changeUser(u, { role: r }, u.full_name + ' is now ' + ROLE_LABEL[r] + '.')}>Make {ROLE_LABEL[r]}</button>
                                  ))}
                                  <button onClick={() => changeUser(u, { is_active: !u.is_active }, u.full_name + (u.is_active ? ' was deactivated.' : ' was activated.'))}>{u.is_active ? 'Deactivate' : 'Activate'}</button>
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
            {loading && !rows.length && <LoadState loading loadingText="Loading users…" />}
            {!loading && !rows.length && <p className="text-muted empty-state">{filtersActive ? 'No users match your search or filters.' : 'No users yet.'}</p>}
            <Pager page={page} totalItems={result.total} pageSize={PAGE_SIZE} onPage={setPage} noun="users" />
          </>
        )}
      </div>
    </>
  );
}
