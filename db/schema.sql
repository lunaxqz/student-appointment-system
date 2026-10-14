
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
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
CREATE TABLE availability (
    availability_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    staff_id INTEGER NOT NULL,
    service_id INTEGER NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,

    FOREIGN KEY (staff_id, service_id)
        REFERENCES staff_services(staff_id, service_id),

    CHECK (end_time > start_time)
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

CREATE INDEX idx_availability_staff_time
    ON availability(staff_id, start_time, end_time);

CREATE INDEX idx_appointment_history_appointment
    ON appointment_history(appointment_id);
