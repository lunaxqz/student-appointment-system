import { useState } from 'react';
import { useApp } from '../../context.jsx';
import Avatar from '../../components/Avatar.jsx';
import { authApi } from '../../lib/endpoints.js';
import { errorMessage } from '../../lib/api.js';

const EMPTY = { current: '', next: '', confirm: '' };

export default function Settings() {
  const { me, toast } = useApp();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  // The server checks the current password and stores the new one (hashed) in PostgreSQL.
  const changePassword = async () => {
    if (!form.current) return toast('Enter your current password.');
    if (form.next.length < 6) return toast('New password needs 6+ characters.');
    if (form.next !== form.confirm) return toast('New passwords do not match.');
    setSaving(true);
    try {
      await authApi.changePassword(form.current, form.next);
      setForm(EMPTY);
      toast('Password updated.');
    } catch (err) {
      toast(errorMessage(err, 'Could not update the password.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p className="page-subtitle">Your administrator account details and password.</p>
        </div>
      </div>

      <div className="dashboard-columns">
        <div className="card">
          <div className="panel-header"><div><h2>Account</h2><p className="text-muted text-small">Signed-in administrator</p></div></div>
          <div className="person-cell"><Avatar name={me.name} /> <div><b>{me.name}</b><div className="text-muted text-small">{me.email}</div></div></div>
        </div>

        <div className="card">
          <div className="panel-header"><div><h2>Change password</h2><p className="text-muted text-small">Use at least 6 characters.</p></div></div>
          <label htmlFor="pw-current">Current password</label>
          <input id="pw-current" type="password" autoComplete="current-password" value={form.current} onChange={set('current')} />
          <label htmlFor="pw-next">New password</label>
          <input id="pw-next" type="password" autoComplete="new-password" value={form.next} onChange={set('next')} />
          <label htmlFor="pw-confirm">Confirm new password</label>
          <input id="pw-confirm" type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} />
          <div style={{ marginTop: 16 }}><button className="button button-primary" onClick={changePassword} disabled={saving}>{saving ? 'Saving…' : 'Update password'}</button></div>
        </div>
      </div>
    </>
  );
}
