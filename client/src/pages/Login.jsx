import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Auth.css";

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    navigate("/dashboard", { state: { email } });
  }

  return (
    <main className="auth-page">
      <aside className="auth-aside">
        <Link to="/" className="auth-brand" aria-label="StudentConnect home">
          <span className="back-btn">←</span>
        </Link>
        <div className="auth-aside-copy">
          <p className="auth-eyebrow">YOUR CAMPUS, CONNECTED</p>
          <h1>Make space for the conversations that matter.</h1>
          <p>Find the guidance and support you need, one appointment at a time.</p>
        </div>
        <span className="auth-aside-foot">Student Appointment System</span>
      </aside>

      <section className="auth-main" aria-labelledby="login-title">
        <Link to="/" className="auth-mobile-brand">
          <span className="brand-mark">SC</span>
          Student<span>Connect</span>
        </Link>
        <div className="auth-card">
          <p className="auth-eyebrow">WELCOME BACK</p>
          <h2 id="login-title">Sign in to your account</h2>
          <p className="auth-subtitle">Pick up where you left off with your campus appointments.</p>

          <div className="auth-preview-note" role="status">
            Preview mode: authentication is not connected. Your password is not sent or saved.
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label htmlFor="login-email">Email address</label>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@university.edu"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />

            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              required
            />

            <button className="auth-submit" type="submit">Continue to dashboard</button>
          </form>

          <p className="auth-switch">
            New to StudentConnect? <Link to="/register">Create an account</Link>
          </p>
          <Link to="/" className="auth-back-link">← Back to home</Link>
        </div>
      </section>
    </main>
  );
}

export default Login;
