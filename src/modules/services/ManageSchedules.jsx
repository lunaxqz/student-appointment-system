import { useState } from 'react';
import { useApp } from '../../context.jsx';
import Avatar from '../../components/Avatar.jsx';
import Schedule from './Schedule.jsx';

export default function ManageSchedules() {
  const { db } = useApp();
  const staff = db.users.filter((u) => u.role === 'staff');
  const [staffId, setStaffId] = useState(staff[0]?.id || '');
  const person = staff.find((s) => s.id === staffId);

  if (!person) return <><h1>Manage Schedules</h1><p className="text-muted">No faculty accounts yet. Add one under Manage Staff.</p></>;

  return (
    <Schedule key={staffId} staffId={staffId} title="Manage Schedules" subtitle="Review and manage faculty availability.">
      <div className="card picker-card">
        <div>
          <label style={{ marginTop: 0 }}>Faculty member</label>
          <select value={staffId} onChange={(e) => setStaffId(e.target.value)}>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="picker-person">
          <Avatar name={person.name} />
          <div><b>{person.name}</b><div className="text-muted text-small">{person.title || 'Faculty'}</div></div>
        </div>
      </div>
    </Schedule>
  );
}
