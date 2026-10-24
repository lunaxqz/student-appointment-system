import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Auth.css";

function Register() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event) {
    event.preventDefault();

    if (password !== confirmPassword) {
      setError("Your passwords do not match. Please try again.");
      return;
    }

    setError("");
    navigate("/dashboard", { state: { name: fullName, email } });
  }

  return (
    <main className="auth-page">
      <aside className="auth-aside">
        <Link to="/" className="auth-brand" aria-label="StudentConnect home">
          <span className="back-btn">←</span>
        </Link>
        <div className="auth-aside-copy">
          <p className="auth-eyebrow">A BETTER WAY TO BOOK</p>
          <h1>Your next step starts with a conversation.</h1>
          <p>Connect with advisers, faculty, and campus services on your schedule.</p>
        </div>
        <span className="auth-aside-foot">Student Appointment System</span>
      </aside>

      <section className="auth-main" aria-labelledby="register-title">
        <Link to="/" className="auth-mobile-brand">
          <span className="brand-mark">SC</span>
          Student<span>Connect</span>
        </Link>
        <div className="auth-card">
          <p className="auth-eyebrow">GET STARTED</p>
          <h2 id="register-title">Create your account</h2>
          <p className="auth-subtitle">Join StudentConnect to keep your campus appointments in one place.</p>

          <div className="auth-preview-note" role="status">
            Preview mode: authentication is not connected. Your password is not sent or saved.
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label htmlFor="register-name">Full name</label>
            <input
              id="register-name"
              name="fullName"
              type="text"
              autoComplete="name"
              placeholder="Your full name"
              maxLength={100}
              required
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />

            <label htmlFor="register-email">Email address</label>
            <input
              id="register-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@university.edu"
              maxLength={150}
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />

            <label htmlFor="register-password">Password</label>
            <input
              id="register-password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="Create a password"
              minLength={8}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />

            <label htmlFor="confirm-password">Confirm password</label>
            <input
              id="confirm-password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="Enter your password again"
              minLength={8}
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />

            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="auth-submit" type="submit">Create account</button>
          </form>

          <p className="auth-switch">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
          <Link to="/" className="auth-back-link">← Back to home</Link>
        </div>
      </section>
    </main>
  );
}

export default Register;
