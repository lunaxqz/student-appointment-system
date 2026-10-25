
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
├── src/                 # React frontend
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
npm install
```

Start the frontend from the project root:

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

**Upgrading a database you created earlier?** Do not re-run `schema.sql`. Run `db/migrations/001_connect_frontend.sql` once instead. It adds the student/faculty profile columns, switches availability to weekly repeating blocks, and adds the double-booking guard. Back up first.

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
# Optional: campus time zone (default Asia/Manila). Used to turn "Monday 09:00" into exact appointment times.
# APP_TIMEZONE=Asia/Manila
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

### 6. (Optional) Load demo data

```bash
cd server
npm run seed-demo
```

This adds the demo services, three faculty members with weekly availability, a demo student and the demo admin. It only adds what is missing. Accounts: `admin@wmsu.edu.ph / admin123`, `reyes@wmsu.edu.ph / staff123` (also `santos@`, `cruz@`), `marksantos@wmsu.edu.ph / student123`.

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

## How the pieces connect

Every screen reads and writes PostgreSQL through the Express API. The browser stores nothing but the login token (in `sessionStorage`).

| Area | Frontend | API |
| --- | --- | --- |
| Sign up / sign in / change password | `modules/auth`, `admin/Settings` | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `PATCH /api/auth/password` |
| Services, faculty, open slots | Find Faculty, Book | `GET /api/services`, `GET /api/faculty`, `GET /api/faculty/:id/slots` |
| Weekly availability | Schedule, Manage Schedules | `GET /api/staff/:id/schedule`, `POST /api/availability`, `DELETE /api/availability/:id` |
| Student / faculty appointments | Book, My Appointments, Requests, dashboards | `GET/POST /api/appointments`, `PATCH /api/appointments/:id/status` |
| Administration | Users, Staff, Appointments, Dashboard | everything under `/api/admin/...` |

`src/lib/endpoints.js` has one function per endpoint. The server enforces the rules (who may do what, no double booking, valid status changes); hiding a button in React is never the only protection.

Tests: `cd server && npm test`.
