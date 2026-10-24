# CampusBook – Student Appointment System

React + Vite. Run:

    npm install
    npm run dev

Demo logins: student@campus.edu / student123 · reyes@campus.edu / staff123 · admin@campus.edu / admin123

## Structure
- `src/modules/auth` – registration, login, password hashing, roles
- `src/modules/services` – services, staff profiles, availability, find faculty
- `src/modules/appointments` – booking, slots, double-booking prevention, status changes
- `src/modules/admin` – dashboard, user management, appointment monitoring
- `src/lib` – shared helpers + database layer (`db.js`, currently localStorage)
- `src/components` – shared UI pieces

Tables: users, services, staff_services, availability, appointments, appointment_history.
`src/lib/db.js` is the only file that touches storage: swap it for API calls to move to a real backend.
