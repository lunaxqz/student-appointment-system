import { Link, useLocation } from "react-router-dom";
import "./Dashboard.css";

const appointments = [
  {
    day: "28",
    month: "OCT",
    title: "Academic advising",
    detail: "Course planning · Student Services",
    time: "10:30 AM",
    status: "Confirmed",
  },
  {
    day: "03",
    month: "NOV",
    title: "Faculty consultation",
    detail: "Research project · Arts & Sciences",
    time: "2:00 PM",
    status: "Pending",
  },
];

function Dashboard() {
  const { state } = useLocation();
  const name = state?.name?.trim() || state?.email?.split("@")[0] || "Student";
  const firstName = name.split(/\s+/)[0];
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <main className="dashboard-page">
      <aside className="dashboard-sidebar">
        <Link to="/" className="dashboard-brand">
          <span className="brand-mark">SC</span>
          <span>Student<span>Connect</span></span>
        </Link>
        <p className="dashboard-nav-label">WORKSPACE</p>
        <nav className="dashboard-nav" aria-label="Dashboard navigation">
          <a className="dashboard-nav-item is-active" href="#overview" aria-current="page">
            <span className="nav-indicator" /> Overview
          </a>
          <a className="dashboard-nav-item" href="#appointments">
            <span className="nav-indicator" /> My appointments
          </a>
          <Link className="dashboard-nav-item" to="/#services">
            <span className="nav-indicator" /> Campus services
          </Link>
        </nav>
        <div className="dashboard-sidebar-bottom">
          <p>Need a hand finding support?</p>
          <Link to="/#services">Explore campus services <span aria-hidden="true">→</span></Link>
          <Link className="dashboard-home-link" to="/">Back to home</Link>
        </div>
      </aside>

      <section className="dashboard-content" id="overview">
        <header className="dashboard-topbar">
          <div className="dashboard-breadcrumb">Workspace <span>/</span> Overview</div>
          <div className="dashboard-profile">
            <span className="dashboard-avatar" aria-hidden="true">{initials}</span>
            <span>{name}</span>
          </div>
        </header>

        <div className="dashboard-main">
          <div className="dashboard-welcome">
            <div>
              <p className="dashboard-eyebrow">STUDENT DASHBOARD</p>
              <h1>Good to see you, {firstName}.</h1>
              <p>Keep track of your appointments and plan your next conversation.</p>
            </div>
            <Link to="/#services" className="dashboard-cta">Find a campus service <span aria-hidden="true">→</span></Link>
          </div>

          <div className="dashboard-preview-note" role="status">
            This is a preview dashboard. Appointment information shown here is sample data.
          </div>

          <section className="dashboard-summary" aria-label="Appointment summary">
            <article className="summary-card">
              <span className="summary-label">UPCOMING</span>
              <strong>02</strong>
              <span className="summary-foot">appointments scheduled</span>
            </article>
            <article className="summary-card">
              <span className="summary-label">AWAITING REVIEW</span>
              <strong>01</strong>
              <span className="summary-foot">request in progress</span>
            </article>
            <article className="summary-card summary-card-accent">
              <span className="summary-label">YOUR NEXT STEP</span>
              <strong>Stay connected</strong>
              <span className="summary-foot">Book time with campus support</span>
            </article>
          </section>

          <section className="appointments-section" id="appointments" aria-labelledby="appointments-title">
            <div className="appointments-heading">
              <div>
                <p className="dashboard-eyebrow">YOUR SCHEDULE</p>
                <h2 id="appointments-title">Upcoming appointments</h2>
              </div>
              <span className="appointment-count">2 appointments</span>
            </div>

            <div className="appointment-list">
              {appointments.map((appointment) => (
                <article className="appointment-card" key={appointment.title}>
                  <div className="appointment-date" aria-label={`${appointment.month} ${appointment.day}`}>
                    <span>{appointment.month}</span>
                    <strong>{appointment.day}</strong>
                  </div>
                  <div className="appointment-info">
                    <h3>{appointment.title}</h3>
                    <p>{appointment.detail}</p>
                  </div>
                  <div className="appointment-time">{appointment.time}</div>
                  <span className={`appointment-status ${appointment.status === "Pending" ? "is-pending" : ""}`}>
                    {appointment.status}
                  </span>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

export default Dashboard;
