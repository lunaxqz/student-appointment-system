import { useEffect, useState } from 'react';
import { AppContext } from './context.jsx';
import { getSession, loadDb, saveDb, seedDb, setSession } from './lib/db.js';
import Sidebar from './components/Sidebar.jsx';
import Topbar from './components/Topbar.jsx';
import Auth from './modules/auth/Auth.jsx';
import FindFaculty from './modules/services/FindFaculty.jsx';
import Schedule from './modules/services/Schedule.jsx';
import ManageStaff from './modules/services/ManageStaff.jsx';
import ManageSchedules from './modules/services/ManageSchedules.jsx';
import Book from './modules/appointments/Book.jsx';
import StaffDashboard from './modules/appointments/StaffDashboard.jsx';
import StaffAppointments from './modules/appointments/StaffAppointments.jsx';
import StudentDashboard from './modules/appointments/StudentDashboard.jsx';
import StudentAppointments from './modules/appointments/StudentAppointments.jsx';
import Dashboard from './modules/admin/Dashboard.jsx';
import Users from './modules/admin/Users.jsx';
import ManageAppointments from './modules/admin/ManageAppointments.jsx';

// Role-based navigation: [page key, label, icon]. A role can only reach pages listed for it.
const NAV = {
  student: [['dashboard', 'Dashboard', 'dashboard'], ['find', 'Find Faculty', 'search'], ['book', 'Book Appointment', 'calendar'], ['mine', 'My Appointments', 'calendarCheck'], ['history', 'Appointment History', 'history']],
  staff: [['dashboard', 'Dashboard', 'dashboard'], ['requests', 'Appointment Requests', 'inbox'], ['schedule', 'Schedule', 'calendar'], ['history', 'Appointment History', 'history']],
  admin: [['dashboard', 'Dashboard', 'dashboard'], ['users', 'Manage Users', 'users'], ['staff', 'Manage Staff', 'userPlus'], ['schedules', 'Manage Schedules', 'clock'], ['appts', 'Manage Appointments', 'calendarCheck']],
};
const PORTAL_LABEL = { student: 'Student portal', staff: 'Faculty portal', admin: 'Admin portal' };
const ROLE_LABEL = { student: 'Student', staff: 'Faculty member', admin: 'Administrator' };

export default function App() {
  const [db, setDb] = useState(null);
  const [meId, setMeId] = useState(null);
  const [page, setPage] = useState('dashboard');
  const [pre, setPre] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => { (async () => { setDb(loadDb() || await seedDb()); setMeId(getSession()); })(); }, []);

  const commit = (fn) => setDb((prev) => { const n = structuredClone(prev); fn(n); saveDb(n); return n; });
  const toast = (t) => { setMsg(t); setTimeout(() => setMsg(''), 3000); };
  const go = (p) => { if (p !== 'book') setPre(''); setPage(p); };
  const login = (id) => { setSession(id); setMeId(id); go('dashboard'); };
  const logout = () => { setSession(null); setMeId(null); };

  if (!db) return <p style={{ padding: 30 }}>Loading…</p>;
  const me = db.users.find((u) => u.id === meId && u.active);
  const ctx = { db, me, commit, toast, go };
  const Toast = msg && <div className="toast">{msg}</div>;

  if (!me) return <AppContext.Provider value={ctx}><Auth onLogin={login} />{Toast}</AppContext.Provider>;

  const pages = {
    student: {
      dashboard: <StudentDashboard />,
      find: <FindFaculty setPre={setPre} />,
      book: <Book pre={pre} />,
      mine: <StudentAppointments mode="mine" />,
      history: <StudentAppointments mode="history" />,
    },
    staff: {
      dashboard: <StaffDashboard />,
      requests: <StaffAppointments mode="requests" />,
      schedule: <Schedule staffId={me.id} title="Schedule" subtitle="Manage availability and review confirmed appointments." />,
      history: <StaffAppointments mode="history" />,
    },
    admin: { dashboard: <Dashboard />, users: <Users />, staff: <ManageStaff />, schedules: <ManageSchedules />, appts: <ManageAppointments /> },
  };
  const title = (NAV[me.role].find(([key]) => key === page) || NAV[me.role][0])[1];

  return (
    <AppContext.Provider value={ctx}>
      <div className="app-layout">
        <Sidebar items={NAV[me.role]} page={page} onNavigate={go} portalLabel={PORTAL_LABEL[me.role]} onLogout={logout} showHelp={me.role === 'student'} />
        <div className="app-body">
          <Topbar title={title} user={me} roleLabel={ROLE_LABEL[me.role]} onLogout={logout} />
          <main className="main-content">{pages[me.role][page] || pages[me.role].dashboard}</main>
        </div>
        {Toast}
      </div>
    </AppContext.Provider>
  );
}
