import { useState } from 'react';
import Avatar from './Avatar.jsx';
import Icon from './Icons.jsx';

export default function Topbar({ title, user, roleLabel, onLogout }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="topbar">
      <div className="breadcrumb">University Portal <span>/</span> <b>{title}</b></div>

      <div className="user-menu">
        <button className="user-menu-button" onClick={() => setOpen(!open)}>
          <Avatar name={user.name} small />
          <span>
            <span className="user-menu-name">{user.name}</span>
            <span className="user-menu-role">{roleLabel}</span>
          </span>
          <Icon name="chevronDown" size={16} />
        </button>
        {open && (
          <>
            <button className="user-menu-backdrop" aria-label="Close menu" onClick={() => setOpen(false)} />
            <div className="user-menu-dropdown">
              <div className="dropdown-label">Signed in as {roleLabel}</div>
              <div className="dropdown-email">{user.email}</div>
              <button className="dropdown-item" onClick={onLogout}>Sign out</button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
