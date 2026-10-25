
import "./Landing.css";

function Landing({ onAuth }) {
  return (
    <div className="landing-page">
      <header className="site-header">
        <div className="layout">
          <a href="#hero" className="brand" aria-label="WMSU Appointment home">
            <span>WMSU <span className="brand-accent">Appointment</span></span>
          </a>
          <nav className="nav-links" aria-label="Main navigation">
            <a href="#hero">Home</a>
            <a href="#services">Services</a>
            <a href="#about">About</a>
          </nav>
          <div className="nav-buttons">
            <button type="button" className="login-btn" onClick={() => onAuth('in')}>Log in</button>
            <button type="button" className="signup-btn" onClick={() => onAuth('up')}>Get started</button>
          </div>
        </div>
      </header>

      <main>
        <section className="hero" id="hero" aria-labelledby="hero-title">
          <div className="hero-content">
            <p className="eyebrow"><span className="eyebrow-line" /> STUDENT SCHEDULING APPOINTMENT SYSTEM</p>
            <h1 id="hero-title">Make time for what <span>moves you forward.</span></h1>
            <p className="hero-description">
              Book time with academic advisers, faculty, and campus services without the back-and-forth.
            </p>
            <div className="hero-buttons">
              <button type="button" className="primary-btn" onClick={() => onAuth('in')}>Book an appointment</button>
              <a href="#services" className="secondary-btn">Explore services</a>
            </div>
            <p className="hero-note"><span className="status-dot" /> A simpler way to connect with campus</p>
          </div>
          <div className="hero-caption" aria-hidden="true">
            <span>Here for your next step</span><span>01 / 03</span>
          </div>
        </section>

        <section className="services" id="services" aria-labelledby="services-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">WHAT WE OFFER</p>
              <h2 id="services-title">Campus services, within reach.</h2>
            </div>
            <p className="section-intro">A clear path to the people and support that help you thrive at school.</p>
          </div>
          <div className="service-cards">
            <article className="service-card">
              <span className="service-number">01</span>
              <h3>Easy Scheduling</h3>
              <p>Choose an available date and time for your appointment.</p>
            </article>
            <article className="service-card">
              <span className="service-number">02</span>
              <h3>Faculty Consultation</h3>
              <p>Arrange meetings with faculty members and academic advisers.</p>
            </article>
            <article className="service-card">
              <span className="service-number">03</span>
              <h3>Track Appointments</h3>
              <p>View your requests and check their status in one place.</p>
            </article>
          </div>
        </section>

        <section className="about" id="about" aria-labelledby="about-title">
          <div>
            <p className="eyebrow">YOUR NEXT STEP STARTS HERE</p>
            <h2 id="about-title">Make every appointment count.</h2>
          </div>
          <div className="about-action">
            <p>Spend less time arranging meetings and more time focusing on your academic goals.</p>
            <button type="button" className="about-link" onClick={() => onAuth('up')}>Create your account <span aria-hidden="true">→</span></button>
          </div>
        </section>
      </main>

      <footer className="footer">
        <a href="#hero" className="footer-brand">WMSU Appointment</a>
        <p>Student Appointment System</p>
        <span>© 2026 WMSU Appointment</span>
      </footer>
    </div>
  );
}

export default Landing;