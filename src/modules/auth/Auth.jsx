import { useState } from 'react';
import { Field } from '../../components/ui.jsx';
import { authApi } from '../../lib/endpoints.js';
import { errorMessage } from '../../lib/api.js';
import './Auth.css';

// Sign-in and sign-up both go to the server (PostgreSQL). Passwords are hashed there; the browser never stores them.
export default function Auth({ onSignedIn, onBack, initialMode = 'in' }) {
  const [mode, setMode] = useState(initialMode);
  const [f, setF] = useState({ lastName: '', firstName: '', middleName: '', email: '', studentId: '', course: '', password: '', confirmPassword: '', role: 'student' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault(); setErr('');
    const email = f.email.trim().toLowerCase();

    if (mode === 'in') {
      if (!email || !f.password) return setErr('Enter your email and password.');
      setBusy(true);
      try {
        const { token, user } = await authApi.login(email, f.password);
        return onSignedIn(token, user);
      } catch (error) {
        return setErr(errorMessage(error, 'Could not sign in. Please try again.'));
      } finally {
        setBusy(false);
      }
    }

    const lastName = f.lastName.trim();
    const firstName = f.firstName.trim();
    const middleName = f.middleName.trim();
    const studentId = f.studentId.trim();
    const course = f.course.trim();
    if (!lastName || !firstName || !email.includes('@')) return setErr('Enter your last name, first name, and a valid email.');
    if (f.role === 'student' && (!studentId || !course)) return setErr('Enter your student ID and course.');
    if (f.password.length < 6) return setErr('Use a password of at least 6 characters.');
    if (f.password !== f.confirmPassword) return setErr('Passwords do not match.');

    setBusy(true);
    try {
      const body = { full_name: [lastName, firstName, middleName].filter(Boolean).join(' '), email, password: f.password, role: f.role };
      if (f.role === 'student') { body.student_id = studentId; body.course = course; }
      const { token, user } = await authApi.register(body);
      onSignedIn(token, user);
    } catch (error) {
      setErr(errorMessage(error, 'Could not create the account. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`login-page${mode === 'up' ? ' login-page--register' : ''}`}>
      <button type="button" className="button" onClick={onBack}>Back to home</button>
      <h1>WMSU <span style={{ color: 'var(--color-primary)' }}>Appointment</span></h1>
      <p className="text-muted">Book time with faculty, offices and campus services.</p>
      <form className={`card auth-form${mode === 'up' ? ' auth-form--register' : ''}`} style={{ marginTop: 18 }} onSubmit={submit}>
        <h2>{mode === 'in' ? 'Sign in' : 'Create an account'}</h2>
        {mode === 'up' && (
          <>
            <div className="auth-name-grid">
              <Field l="Last name"><input value={f.lastName} onChange={set('lastName')} /></Field>
              <Field l="First name"><input value={f.firstName} onChange={set('firstName')} /></Field>
              <Field l="Middle name (optional)"><input value={f.middleName} onChange={set('middleName')} /></Field>
            </div>
            <div className="auth-role-email-grid">
              <Field l="I am a">
                <select value={f.role} onChange={set('role')}>
                  <option value="student">Student</option>
                  <option value="staff">Faculty / staff</option>
                </select>
              </Field>
              <Field l="Email"><input type="email" value={f.email} onChange={set('email')} /></Field>
            </div>
            {f.role === 'student' && (
              <div className="auth-student-grid">
                <Field l="Student ID"><input placeholder="e.g. 2023-01234" value={f.studentId} onChange={set('studentId')} required /></Field>
                <Field l="Course"><input placeholder="e.g. BS Computer Science" value={f.course} onChange={set('course')} required /></Field>
              </div>
            )}
          </>
        )}
        {mode === 'in' && <Field l="Email"><input type="email" value={f.email} onChange={set('email')} /></Field>}
        {mode === 'up' ? (
          <div className="auth-password-grid">
            <Field l="Password">
              <div className="password-field">
                <input type={showPassword ? 'text' : 'password'} value={f.password} onChange={set('password')} />
                <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </Field>
            <Field l="Confirm password">
              <div className="password-field">
                <input type={showPassword ? 'text' : 'password'} value={f.confirmPassword} onChange={set('confirmPassword')} />
                <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </Field>
          </div>
        ) : (
          <Field l="Password">
            <div className="password-field">
              <input type={showPassword ? 'text' : 'password'} value={f.password} onChange={set('password')} />
              <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </Field>
        )}
        {err && <div className="error-text">{err}</div>}
        <div className="form-row" style={{ marginTop: 14 }}>
          <button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'in' ? 'Sign in' : 'Create account'}</button>
          <button type="button" className="button" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setErr(''); }}>
            {mode === 'in' ? 'Need an account?' : 'Have an account?'}
          </button>
        </div>
      </form>
      <div className="card text-small text-muted">
        <b style={{ color: 'var(--color-text)' }}>Demo accounts</b><br />
        marksantos@wmsu.edu.ph / student123<br />reyes@wmsu.edu.ph / staff123<br />
        admin@wmsu.edu.ph / admin123<br />
        <span>Created by <code>npm run seed-demo</code> in the server folder.</span>
      </div>
    </div>
  );
}
