-- Upgrades an EXISTING database (created from the older db/schema.sql) so the whole app can run on PostgreSQL.
-- Fresh databases do not need this: db/schema.sql already contains these changes.
-- Safe to run once. It is wrapped in a transaction, so a failure changes nothing.
-- Campus time zone used to convert old availability rows: change 'Asia/Manila' if yours differs
-- (it must match APP_TIMEZONE in server/.env).

BEGIN;

-- users: student details and the faculty profile
ALTER TABLE users ADD COLUMN IF NOT EXISTS student_id VARCHAR(30);
ALTER TABLE users ADD COLUMN IF NOT EXISTS course VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS title VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS dept VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT NOT NULL DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS users_student_id_key ON users(student_id);

-- availability: one-off timestamps -> weekly repeating blocks
ALTER TABLE availability ADD COLUMN IF NOT EXISTS weekday SMALLINT;
ALTER TABLE availability ADD COLUMN IF NOT EXISTS start_clock TIME;
ALTER TABLE availability ADD COLUMN IF NOT EXISTS end_clock TIME;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'availability' AND column_name = 'start_time') THEN
        UPDATE availability
        SET weekday = EXTRACT(DOW FROM start_time AT TIME ZONE 'Asia/Manila')::smallint,
            start_clock = (start_time AT TIME ZONE 'Asia/Manila')::time,
            end_clock = (end_time AT TIME ZONE 'Asia/Manila')::time
        WHERE weekday IS NULL;
        ALTER TABLE availability DROP COLUMN start_time;
        ALTER TABLE availability DROP COLUMN end_time;
    END IF;
END $$;

-- Drop unusable leftovers (only ones nobody has booked)
DELETE FROM availability
WHERE (weekday IS NULL OR start_clock IS NULL OR end_clock IS NULL OR end_clock <= start_clock)
  AND NOT EXISTS (SELECT 1 FROM appointments a WHERE a.availability_id = availability.availability_id);

ALTER TABLE availability ALTER COLUMN weekday SET NOT NULL;
ALTER TABLE availability ALTER COLUMN start_clock SET NOT NULL;
ALTER TABLE availability ALTER COLUMN end_clock SET NOT NULL;
ALTER TABLE availability ADD CONSTRAINT availability_weekday_check CHECK (weekday BETWEEN 0 AND 6);
ALTER TABLE availability ADD CONSTRAINT availability_clock_check CHECK (end_clock > start_clock);

CREATE INDEX IF NOT EXISTS idx_availability_staff_day ON availability(staff_id, weekday);

-- appointments: no two pending/approved requests for the same slot (fails if such duplicates already exist)
CREATE UNIQUE INDEX IF NOT EXISTS uq_appointments_active_slot
    ON appointments(availability_id, appointment_date)
    WHERE status IN ('pending', 'approved');

COMMIT;
