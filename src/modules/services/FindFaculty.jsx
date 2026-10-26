import { useState } from 'react';
import { useApp } from '../../context.jsx';
import Icon from '../../components/Icons.jsx';
import Avatar from '../../components/Avatar.jsx';
import LoadState from '../../components/LoadState.jsx';
import useLoad from '../../lib/useLoad.js';
import { catalogApi } from '../../lib/endpoints.js';
import { DAYS, f12, ymd } from '../../lib/utils.js';
import { dayLabel } from '../appointments/logic.js';

export default function FindFaculty({ setPre }) {
  const { go } = useApp();
  const { data, loading, error, reload } = useLoad((signal) => Promise.all([catalogApi.faculty({}, signal), catalogApi.services(signal)]), []);
  const [query, setQuery] = useState('');
  const [service, setService] = useState('');
  const [availability, setAvailability] = useState('');
  const [openProfile, setOpenProfile] = useState('');

  if (!data) return <div className="card"><LoadState loading={loading} error={error} onRetry={reload} loadingText="Loading faculty…" /></div>;
  const [faculty, services] = data;
  const serviceName = (id) => services.find((x) => x.id === id)?.name || '';

  const weekFromNow = new Date();
  weekFromNow.setDate(weekFromNow.getDate() + 7);

  const list = faculty
    .map((user) => ({ user, serviceIds: user.service_ids, next: user.next_open }))
    .filter(({ user, serviceIds, next }) => {
      const text = (user.name + user.title + user.dept + serviceIds.map(serviceName).join(' ')).toLowerCase();
      if (!text.includes(query.toLowerCase())) return false;
      if (service && !serviceIds.includes(Number(service))) return false;
      if (availability === 'week' && !(next && next.date <= ymd(weekFromNow))) return false;
      return true;
    })
    .sort((a, b) => (a.next ? a.next.date + a.next.time : '9').localeCompare(b.next ? b.next.date + b.next.time : '9'));

  const clearFilters = () => { setQuery(''); setService(''); setAvailability(''); };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Find Faculty</h1>
          <p className="page-subtitle">Find the right faculty member for your academic needs.</p>
        </div>
      </div>

      <div className="toolbar card">
        <div className="search-field">
          <Icon name="search" size={18} />
          <input placeholder="Search by name or service…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select value={service} onChange={(e) => setService(e.target.value)}>
          <option value="">All services</option>
          {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={availability} onChange={(e) => setAvailability(e.target.value)}>
          <option value="">Any availability</option>
          <option value="week">Available within 7 days</option>
        </select>
        <button className="button" onClick={clearFilters}>Clear filters</button>
      </div>

      <div className="results-bar">
        <span><b>{list.length}</b> faculty members available</span>
        <span>Sorted by earliest availability</span>
      </div>

      <div className="faculty-grid">
        {list.map(({ user, serviceIds, next }) => {
          const days = user.weekdays.map((w) => DAYS[w]);
          return (
            <div className="card faculty-card" key={user.id}>
              <div className="faculty-head">
                <Avatar name={user.name} />
                <div>
                  <b>{user.name}</b>
                  <div className="text-muted text-small">{user.title || 'Faculty'}</div>
                </div>
              </div>
              <p className="text-small">{user.bio || 'Provides student-centered guidance through individual appointments.'}</p>
              <div className="tag-list">{serviceIds.map((i) => <span className="tag" key={i}>{serviceName(i)}</span>)}</div>

              {openProfile === user.id && (
                <div className="profile-details text-small">
                  <div><b>Office:</b> {user.dept || '—'}</div>
                  <div><b>Available on:</b> {days.join(', ') || 'No schedule yet'}</div>
                </div>
              )}

              <div className="faculty-next">
                <Icon name="calendar" />
                <div>
                  <div className="text-muted text-small">Next available</div>
                  <b>{next ? dayLabel(next.date) + ', ' + f12(next.time) : 'No open slots'}</b>
                </div>
              </div>
              <div className="faculty-actions">
                <button className="button" onClick={() => setOpenProfile(openProfile === user.id ? '' : user.id)}>View profile</button>
                <button className="button button-primary" onClick={() => { setPre(user.id); go('book'); }}>Book now</button>
              </div>
            </div>
          );
        })}
      </div>
      {!list.length && <p className="text-muted">No one matches. Clear the filters and try again.</p>}
    </>
  );
}
