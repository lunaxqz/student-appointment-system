<<<<<<< HEAD
# Student Appointment Scheduling System

A web-based Student Appointment Scheduling System built using React, Node.js, Express, and PostgreSQL.

## Project Overview

The system allows students to request appointments with university staff and service providers. Staff members can manage availability and review appointment requests, while administrators oversee the system.

## Technology Stack

- **Frontend:** React + Vite
- **Backend:** Node.js + Express
- **Database:** PostgreSQL
- **Database Driver:** node-postgres (`pg`)
- **Version Control:** Git and GitHub

## Project Structure

```text
student-appointment-system/
├── client/              # React frontend
├── server/              # Express backend
│   ├── middleware/      # Shared middleware
│   ├── controllers/    # Feature logic
│   ├── routes/         # API routes
│   ├── utils/          # Helper functions
│   ├── db.js           # PostgreSQL connection
│   ├── server.js        # Backend entry point
│   └── .env.example     # Environment variable template
├── db/
│   └── schema.sql       # Database table definitions
├── docs/                # Project documentation
└── README.md
```

## Prerequisites

Install the following before running the project:

- [Node.js](https://nodejs.org/) and npm
- [PostgreSQL](https://www.postgresql.org/)
- [Git](https://git-scm.com/)
- A code editor such as Visual Studio Code

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/lunaxqz/student-appointment-system.git
cd student-appointment-system
```

### 2. Install frontend dependencies

```bash
cd client
npm install
```

Start the frontend:

```bash
npm run dev
```

Vite will display the local URL, usually `http://localhost:5173`.

Keep this terminal running.

### 3. Set up the database

Create a PostgreSQL database named:

```sql
CREATE DATABASE appointments_db;
```

Run the SQL statements in `db/schema.sql` against that database using pgAdmin or the PostgreSQL command-line tool.

The schema should be applied only once to a fresh database. If the tables already exist, do not execute it again without checking first.

### 4. Configure the backend

Open a second terminal from the project root:

```bash
cd server
npm install
```

Create a file named `.env` inside the `server` folder by copying `.env.example`.

Fill in the values using your **own local PostgreSQL credentials**:

```env
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=appointments_db
DB_USER=postgres
DB_PASSWORD=your_local_postgres_password
```

Do not commit or share your real `.env` file.

### 5. Start the backend

From the `server` directory:

```bash
npm run dev
```

The backend should run at `http://localhost:5000`.

Test the API:

- `http://localhost:5000/`
- `http://localhost:5000/api/db-test`

Keep the backend terminal running separately from the frontend terminal.

## Development Notes

- The frontend and backend run in separate terminals.
- Each team member should work on an assigned feature and coordinate changes with the team.
- Keep database credentials private.
- Do not commit `node_modules/` or `.env` files.
- Pull the latest shared changes before starting work.
- Coordinate changes to shared files such as the database schema and server entry point before merging.

## Git Workflow

Before starting work:

```bash
git switch main
git pull origin main
git switch -c feature/your-feature-name
```

Make and commit changes on your feature branch:

```bash
git add .
git commit -m "Describe your changes"
git push -u origin feature/your-feature-name
```

Open a pull request on GitHub to merge the feature branch into `main`. Have a teammate review it before merging.

Replace `feature/your-feature-name` with a descriptive branch name, such as `feature/authentication`.

Avoid having multiple members independently change the same shared files without coordinating.

## Team Feature Areas

The system is organized into four main feature areas:

1. **User Accounts & Authentication**
2. **Services, Staff & Availability**
3. **Appointments & Scheduling**
4. **Administration & System Management**

The team should coordinate ownership of these areas. All members are expected to contribute to planning, testing, integration, and documentation.

## Current Project Status

The initial project structure, PostgreSQL schema, backend database connection, and development setup are in place. Feature implementation and integration remain part of the team's development work.
=======
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
>>>>>>> origin/main
