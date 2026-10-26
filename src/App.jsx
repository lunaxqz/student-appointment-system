import { useEffect, useState } from 'react';
import { AppContext } from './context.jsx';
import { SESSION_EXPIRED_EVENT, getToken, setToken } from './lib/api.js';
import { adminApi, authApi } from './lib/endpoints.js';
import Sidebar from './components/Sidebar.jsx';
import Topbar from './components/Topbar.jsx';
import Auth from './modules/auth/Auth.jsx';
import Landing from './modules/auth/Landing.jsx';
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
import Settings from './modules/admin/Settings.jsx';

// Role-based navigation: [page key, label, icon]. A role can only reach pages listed for it.
const NAV = {
  student: [['dashboard', 'Dashboard', 'dashboard'], ['find', 'Find Faculty', 'search'], ['book', 'Book Appointment', 'calendar'], ['mine', 'My Appointments', 'calendarCheck'], ['history', 'Appointment History', 'history']],
  staff: [['dashboard', 'Dashboard', 'dashboard'], ['requests', 'Appointment Requests', 'inbox'], ['schedule', 'Schedule', 'calendar'], ['history', 'Appointment History', 'history']],
  admin: [['dashboard', 'Dashboard', 'dashboard'], ['users', 'Manage Users', 'users'], ['staff', 'Manage Staff', 'userPlus'], ['schedules', 'Manage Schedules', 'clock'], ['appts', 'Manage Appointments', 'calendarCheck']],
};
// Extra links shown under the main menu, next to Log out.
const NAV_FOOTER = { admin: [['settings', 'Settings', 'settings']] };
const BRAND = { admin: 'Student Appointment' };
const PORTAL_LABEL = { student: 'Student portal', staff: 'Faculty portal', admin: 'Admin portal' };
const ROLE_LABEL = { student: 'Student', staff: 'Faculty member', admin: 'Administrator' };

export default function App() {
  const [me, setMe] = useState(null); // the signed-in user, as returned by the server: { id, name, email, role }
  const [restoring, setRestoring] = useState(() => Boolean(getToken()));
  const [page, setPage] = useState('dashboard');
  const [pre, setPre] = useState('');
  const [intent, setIntent] = useState('');
  const [msg, setMsg] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState('in');

  const toast = (t) => { setMsg(t); setTimeout(() => setMsg(''), 3000); };
  const go = (p, why = '') => { if (p !== 'book') setPre(''); setIntent(why); setPage(p); };
  const signedIn = (token, user) => { setToken(token); setMe(user); go('dashboard'); };
  const logout = () => { setToken(null); setMe(null); setShowAuth(false); };

  // Reopening the tab keeps the user signed in as long as the server still accepts the token.
  useEffect(() => {
    if (!getToken()) return undefined;
    const controller = new AbortController();
    authApi.me(controller.signal)
      .then(setMe)
      .catch(() => { /* a rejected token is cleared by the API client */ })
      .finally(() => { if (!controller.signal.aborted) setRestoring(false); });
    return () => controller.abort();
  }, []);

  // The API client fires this when the server rejects the token (expired, or the account was deactivated).
  useEffect(() => {
    const onExpired = () => { setMe(null); toast('Your session ended. Please sign in again.'); };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  // The admin bell shows how many requests are waiting; refresh the number whenever the admin changes page.
  const isAdmin = me?.role === 'admin';
  useEffect(() => {
    if (!isAdmin) return undefined;
    const controller = new AbortController();
    adminApi.dashboard(controller.signal).then((d) => setPendingCount(d.appointments.pending)).catch(() => {});
    return () => controller.abort();
  }, [isAdmin, page]);

  if (restoring) return <p style={{ padding: 30 }}>Loading…</p>;
  const ctx = { me, toast, go, intent };
  const Toast = msg && <div className="toast">{msg}</div>;

  if (!me) {
    const openAuth = (mode) => {
      setAuthMode(mode);
      setShowAuth(true);
    };

    return (
      <AppContext.Provider value={ctx}>
        {showAuth
          ? <Auth onSignedIn={signedIn} onBack={() => setShowAuth(false)} initialMode={authMode} />
          : <Landing onAuth={openAuth} />}
        {Toast}
      </AppContext.Provider>
    );
  }

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
    admin: { dashboard: <Dashboard />, users: <Users />, staff: <ManageStaff />, schedules: <ManageSchedules />, appts: <ManageAppointments />, settings: <Settings /> },
  };
  const footerItems = NAV_FOOTER[me.role] || [];
  const title = ([...NAV[me.role], ...footerItems].find(([key]) => key === page) || NAV[me.role][0])[1];
  const notifications = isAdmin ? { count: pendingCount, onClick: () => go('appts') } : undefined;

  return (
    <AppContext.Provider value={ctx}>
      <div className={'app-layout' + (isAdmin ? ' theme-admin' : '')}>
        <Sidebar items={NAV[me.role]} footerItems={footerItems} brand={BRAND[me.role]} page={page} onNavigate={go} portalLabel={PORTAL_LABEL[me.role]} onLogout={logout} showHelp={me.role === 'student' || isAdmin} />
        <div className="app-body">
          <Topbar title={title} user={me} roleLabel={ROLE_LABEL[me.role]} onLogout={logout} notifications={notifications} />
          <main className="main-content">{pages[me.role][page] || pages[me.role].dashboard}</main>
        </div>
        {Toast}
      </div>
    </AppContext.Provider>
  );
}
