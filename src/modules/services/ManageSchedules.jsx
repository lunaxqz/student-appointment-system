import { useState } from 'react';
import Avatar from '../../components/Avatar.jsx';
import LoadState from '../../components/LoadState.jsx';
import useLoad from '../../lib/useLoad.js';
import { adminApi } from '../../lib/endpoints.js';
import Schedule from './Schedule.jsx';

export default function ManageSchedules() {
  const { data: staff, loading, error, reload } = useLoad((signal) => adminApi.staff(signal), []);
  const [chosenId, setChosenId] = useState('');

  if (!staff) return <><h1>Manage Schedules</h1><div className="card"><LoadState loading={loading} error={error} onRetry={reload} loadingText="Loading faculty…" /></div></>;
  if (!staff.length) return <><h1>Manage Schedules</h1><p className="text-muted">No faculty accounts yet. Add one under Manage Staff.</p></>;

  const person = staff.find((s) => s.id === Number(chosenId)) || staff[0];

  return (
    <Schedule key={person.id} staffId={person.id} title="Manage Schedules" subtitle="Review and manage faculty availability.">
      <div className="card picker-card">
        <div>
          <label style={{ marginTop: 0 }}>Faculty member</label>
          <select value={person.id} onChange={(e) => setChosenId(e.target.value)}>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        </div>
        <div className="picker-person">
          <Avatar name={person.full_name} />
          <div><b>{person.full_name}</b><div className="text-muted text-small">{person.title || 'Faculty'}</div></div>
        </div>
      </div>
    </Schedule>
  );
}
