
-- ==========================================
-- STUDENT APPOINTMENT SCHEDULING SYSTEM
-- Complete PostgreSQL Database Schema
-- ==========================================

-- 1. USERS
CREATE TABLE users (
    user_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL
        CHECK (role IN ('student', 'staff', 'admin')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- students (set at registration)
    student_id VARCHAR(30) UNIQUE,
    course VARCHAR(100),

    -- faculty / staff profile (shown on Find Faculty)
    title VARCHAR(100) NOT NULL DEFAULT '',
    dept VARCHAR(100) NOT NULL DEFAULT '',
    bio TEXT NOT NULL DEFAULT ''
);

-- 2. SERVICES
CREATE TABLE services (
    service_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    service_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. STAFF-SERVICE ASSIGNMENTS
CREATE TABLE staff_services (
    staff_id INTEGER NOT NULL REFERENCES users(user_id),
    service_id INTEGER NOT NULL REFERENCES services(service_id),
    PRIMARY KEY (staff_id, service_id)
);

-- 4. STAFF AVAILABILITY
-- A block repeats every week: e.g. weekday 1 (Monday), 09:00 to 12:00 campus time.
-- It is split into 30-minute slots that students can book. Blocks that already have
-- appointments are switched off (is_available = FALSE) instead of deleted, to keep history.
CREATE TABLE availability (
    availability_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    staff_id INTEGER NOT NULL,
    service_id INTEGER NOT NULL,
    weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),  -- 0 = Sunday ... 6 = Saturday
    start_clock TIME NOT NULL,
    end_clock TIME NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,

    FOREIGN KEY (staff_id, service_id)
        REFERENCES staff_services(staff_id, service_id),

    CHECK (end_clock > start_clock)
);

-- 5. APPOINTMENTS
CREATE TABLE appointments (
    appointment_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(user_id),
    availability_id INTEGER NOT NULL
        REFERENCES availability(availability_id),
    appointment_date TIMESTAMPTZ NOT NULL,
    reason TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN (
            'pending',
            'approved',
            'rejected',
            'cancelled',
            'completed'
        )),
    reviewed_by INTEGER REFERENCES users(user_id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. APPOINTMENT STATUS HISTORY
CREATE TABLE appointment_history (
    history_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    appointment_id INTEGER NOT NULL
        REFERENCES appointments(appointment_id),
    changed_by INTEGER REFERENCES users(user_id),
    old_status VARCHAR(20),
    new_status VARCHAR(20) NOT NULL
        CHECK (new_status IN (
            'pending',
            'approved',
            'rejected',
            'cancelled',
            'completed'
        )),
    notes TEXT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- INDEXES
-- ==========================================

CREATE INDEX idx_appointments_student
    ON appointments(student_id);

CREATE INDEX idx_appointments_availability
    ON appointments(availability_id);

CREATE INDEX idx_appointments_status
    ON appointments(status);

CREATE INDEX idx_availability_staff_day
    ON availability(staff_id, weekday);

-- Database-level guard against double booking: one pending/approved appointment per slot.
CREATE UNIQUE INDEX uq_appointments_active_slot
    ON appointments(availability_id, appointment_date)
    WHERE status IN ('pending', 'approved');

CREATE INDEX idx_appointment_history_appointment
    ON appointment_history(appointment_id);
