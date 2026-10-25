import { useApp } from '../context.jsx';
import Icon from './Icons.jsx';

export default function Sidebar({ items, footerItems = [], brand = 'WMSU Appointment', page, onNavigate, portalLabel, onLogout, showHelp }) {
  const { toast } = useApp();
  return (
    <nav className="sidebar">
      <div className="sidebar-brand-row">
        <div className="sidebar-logo"><Icon name="calendarCheck" size={24} /></div>
        <div>
          <div className="sidebar-brand">{brand}</div>
          <div className="sidebar-subtitle">University Portal</div>
        </div>
      </div>

      <div className="sidebar-section-label">{portalLabel}</div>
      {items.map(([key, label, icon]) => (
        <button key={key} className={'nav-button' + (page === key ? ' active' : '')} onClick={() => onNavigate(key)}>
          <Icon name={icon} /> {label}
        </button>
      ))}

      <div className="sidebar-footer">
        {footerItems.map(([key, label, icon]) => (
          <button key={key} className={'nav-button' + (page === key ? ' active' : '')} onClick={() => onNavigate(key)}>
            <Icon name={icon} /> {label}
          </button>
        ))}
        <button className="nav-button" onClick={onLogout}><Icon name="logout" /> Log out</button>
        {showHelp && (
          <div className="help-card">
            <Icon name="sparkle" size={20} />
            <b>Need assistance?</b>
            <p>Visit the student help center</p>
            <button className="help-link" onClick={() => toast('The help center is not set up yet.')}>
              Open help center <Icon name="arrow" size={16} />
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
