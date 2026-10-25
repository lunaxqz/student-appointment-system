import { useState } from 'react';
import { useApp } from '../../context.jsx';
import { Field } from '../../components/ui.jsx';
import { hashPassword } from './password.js';
import { uid } from '../../lib/utils.js';

export default function Auth({ onLogin }) {
  const { db, commit } = useApp();
  const [mode, setMode] = useState('in');
  const [f, setF] = useState({ lastName: '', firstName: '', middleName: '', email: '', password: '', confirmPassword: '', role: 'student' });
  const [err, setErr] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault(); setErr('');
    const email = f.email.trim().toLowerCase();
    const lastName = f.lastName.trim();
    const firstName = f.firstName.trim();
    const middleName = f.middleName.trim();
    const hash = await hashPassword(f.password);
    if (mode === 'in') {
      const u = db.users.find((x) => x.email === email && x.password_hash === hash);
      if (!u) return setErr('Email or password is incorrect.');
      if (!u.active) return setErr('This account is deactivated. Contact an administrator.');
      return onLogin(u.id);
    }
    if (!lastName || !firstName || !email.includes('@')) return setErr('Enter your last name, first name, and a valid email.');
    if (f.password.length < 6) return setErr('Use a password of at least 6 characters.');
    if (f.password !== f.confirmPassword) return setErr('Passwords do not match.');
    if (db.users.some((x) => x.email === email)) return setErr('An account with this email already exists.');
    const fullName = [lastName, firstName, middleName].filter(Boolean).join(' ');
    const id = uid('u_');
    commit((d) => d.users.push({ id, name: fullName, email, password_hash: hash, role: f.role, active: true, title: '', dept: '', bio: '' }));
    onLogin(id);
  };

  return (
    <div className="login-page">
      <h1>WMSU <span style={{ color: 'var(--color-primary)' }}>Appointment</span></h1>
      <p className="text-muted">Book time with faculty, offices and campus services.</p>
      <form className="card" style={{ marginTop: 18 }} onSubmit={submit}>
        <h2>{mode === 'in' ? 'Sign in' : 'Create an account'}</h2>
        {mode === 'up' && (
          <>
            <Field l="Last name"><input value={f.lastName} onChange={set('lastName')} /></Field>
            <Field l="First name"><input value={f.firstName} onChange={set('firstName')} /></Field>
            <Field l="Middle name (optional)"><input value={f.middleName} onChange={set('middleName')} /></Field>
          </>
        )}
        <Field l="Email"><input type="email" value={f.email} onChange={set('email')} /></Field>
        <Field l="Password">
          <div className="password-field">
            <input type={showPassword ? 'text' : 'password'} value={f.password} onChange={set('password')} />
            <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}>
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </Field>
        {mode === 'up' && (
          <Field l="Confirm password">
            <div className="password-field">
              <input type={showPassword ? 'text' : 'password'} value={f.confirmPassword} onChange={set('confirmPassword')} />
              <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </Field>
        )}
        {mode === 'up' && (
          <Field l="I am a">
            <select value={f.role} onChange={set('role')}>
              <option value="student">Student</option>
              <option value="staff">Faculty / staff</option>
            </select>
          </Field>
        )}
        {err && <div className="error-text">{err}</div>}
        <div className="form-row" style={{ marginTop: 14 }}>
          <button className="button button-primary" type="submit">{mode === 'in' ? 'Sign in' : 'Create account'}</button>
          <button type="button" className="button" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setErr(''); }}>
            {mode === 'in' ? 'Need an account?' : 'Have an account?'}
          </button>
        </div>
      </form>
      <div className="card text-small text-muted">
        <b style={{ color: 'var(--color-text)' }}>Demo accounts</b><br />
        marksantos@wmsu.edu.ph / student123<br />reyes@wmsu.edu.ph / staff123<br />admin@wmsu.edu.ph / admin123
      </div>
    </div>
  );
}
