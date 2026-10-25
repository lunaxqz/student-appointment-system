// Fills an empty database with demo data: services, faculty/staff with their services and weekly availability,
// a demo student and the demo admin. Safe to run again: it only adds what is missing and never changes existing accounts.
// Usage:  npm run seed-demo      (development only)
//
// Schedule blocks are [weekday, start, end] in campus time. weekday: 0 = Sunday ... 6 = Saturday.
// Each block is cut into 30-minute slots students can book, so keep times on :00 / :30.
const bcrypt = require('bcryptjs');
const pool = require('../db');
const withTransaction = require('../utils/transaction');
const ensureDemoAdmin = require('../utils/demoAdmin');

const SERVICES = [
    ['Academic Advising', 'Course planning, thesis guidance and academic standing.'],
    ['Registrar Services', 'Enrollment, records, transcripts and clearance.'],
    ['Counseling', 'Confidential counseling and student wellness support.'],
    ['Financial Aid', 'Tuition assistance, payment plans and financial concerns.'],
    ['Career Services', 'Resume reviews, internships and job-readiness coaching.'],
    ['Library Services', 'Research help, borrowing and thesis resources.'],
    ['IT Help Desk', 'Student portal, campus Wi-Fi and account access issues.'],
    ['Health Services', 'Campus clinic consultations and medical certificates.'],
];

// `offers` lists every service the person provides, each with its own weekly blocks.
const STAFF = [
    { name: 'Dr. Maria Reyes', email: 'reyes@wmsu.edu.ph', title: 'Associate Professor', dept: 'College of Computing',
      bio: 'Thesis advising and academic planning.',
      offers: { 'Academic Advising': [[1, '09:00', '12:00'], [3, '13:00', '16:00']] } },
    { name: 'Mr. Jun Santos', email: 'santos@wmsu.edu.ph', title: 'Registrar Officer', dept: 'Registrar’s Office',
      bio: 'Enrollment, records and clearance.',
      offers: { 'Registrar Services': [[2, '09:00', '11:30'], [4, '09:00', '11:30']] } },
    { name: 'Ms. Lea Cruz', email: 'cruz@wmsu.edu.ph', title: 'Guidance Counselor', dept: 'Student Affairs',
      bio: 'Confidential counseling and wellness.',
      offers: { 'Counseling': [[1, '10:00', '12:00'], [5, '13:00', '15:00']] } },

    { name: 'Prof. Antonio Dela Cruz', email: 'delacruz@wmsu.edu.ph', title: 'Professor', dept: 'College of Engineering',
      bio: 'Engineering curriculum, subject loads and shifting programs.',
      offers: { 'Academic Advising': [[2, '13:00', '16:00'], [4, '13:00', '16:00']] } },
    { name: 'Dr. Carmela Villanueva', email: 'villanueva@wmsu.edu.ph', title: 'Assistant Professor', dept: 'College of Business',
      bio: 'Academic advising for business students and career coaching for graduating batches.',
      offers: { 'Academic Advising': [[3, '09:00', '12:00']], 'Career Services': [[5, '09:00', '12:00']] } },
    { name: 'Ms. Rhea Mendoza', email: 'mendoza@wmsu.edu.ph', title: 'Records Evaluator', dept: 'Registrar’s Office',
      bio: 'Transcript requests, grade corrections and diploma processing.',
      offers: { 'Registrar Services': [[1, '13:00', '16:00'], [3, '09:00', '11:30'], [5, '09:00', '11:30']] } },
    { name: 'Mr. Paolo Garcia', email: 'garcia@wmsu.edu.ph', title: 'Financial Aid Officer', dept: 'Office of Student Financial Assistance',
      bio: 'Scholarships, tuition discounts and installment arrangements.',
      offers: { 'Financial Aid': [[1, '09:00', '12:00'], [2, '13:00', '16:00'], [4, '09:00', '12:00']] } },
    { name: 'Ms. Isabel Ramos', email: 'ramos@wmsu.edu.ph', title: 'University Librarian', dept: 'University Library',
      bio: 'Research consultations, thesis repository and library accounts.',
      offers: { 'Library Services': [[2, '09:00', '12:00'], [4, '13:00', '16:00']], 'IT Help Desk': [[6, '09:00', '11:00']] } },
    { name: 'Mr. Daniel Aquino', email: 'aquino@wmsu.edu.ph', title: 'Systems Administrator', dept: 'Information Technology Office',
      bio: 'Portal logins, campus email and Wi-Fi troubleshooting.',
      offers: { 'IT Help Desk': [[1, '13:00', '16:00'], [3, '13:00', '16:00'], [5, '09:00', '12:00']] } },
    { name: 'Dr. Sofia Bautista', email: 'bautista@wmsu.edu.ph', title: 'University Physician', dept: 'Health Services Unit',
      bio: 'General consultations, health clearances and medical certificates.',
      offers: { 'Health Services': [[1, '08:00', '11:00'], [3, '08:00', '11:00'], [5, '14:00', '16:30']] } },
    { name: 'Mr. Ramon Lim', email: 'lim@wmsu.edu.ph', title: 'Career Development Officer', dept: 'Career and Placement Office',
      bio: 'Resume clinics, mock interviews and internship placement.',
      offers: { 'Career Services': [[2, '10:00', '12:00'], [4, '14:00', '17:00']] } },
    { name: 'Mr. Miguel Flores', email: 'flores@wmsu.edu.ph', title: 'Guidance Counselor', dept: 'Student Affairs',
      bio: 'Peer and stress counseling, with extended Wednesday hours.',
      offers: { 'Counseling': [[3, '09:00', '12:00'], [5, '09:00', '11:00']] } },
];

async function main() {
    if (process.env.NODE_ENV === 'production') throw new Error('Refusing to add demo accounts in production.');

    await ensureDemoAdmin();
    const staffHash = await bcrypt.hash('staff123', 10);
    const studentHash = await bcrypt.hash('student123', 10);

    let added = 0;
    await withTransaction(async (client) => {
        const serviceIds = {};
        for (const [name, description] of SERVICES) {
            // Adds the service, or fills in its description if it exists without one. Never overwrites an edited description.
            const { rows } = await client.query(
                `INSERT INTO services (service_name, description) VALUES ($1, $2)
                 ON CONFLICT (service_name) DO UPDATE SET description = COALESCE(NULLIF(services.description, ''), EXCLUDED.description)
                 RETURNING service_id`,
                [name, description]
            );
            serviceIds[name] = rows[0].service_id;
        }

        for (const s of STAFF) {
            const created = await client.query(
                `INSERT INTO users (full_name, email, password_hash, role, title, dept, bio) VALUES ($1, $2, $3, 'staff', $4, $5, $6)
                 ON CONFLICT (email) DO NOTHING RETURNING user_id`,
                [s.name, s.email, staffHash, s.title, s.dept, s.bio]
            );
            if (!created.rows[0]) continue; // already exists: leave it and its schedule alone
            const staffId = created.rows[0].user_id;
            added += 1;
            for (const [service, blocks] of Object.entries(s.offers)) {
                await client.query('INSERT INTO staff_services (staff_id, service_id) VALUES ($1, $2)', [staffId, serviceIds[service]]);
                for (const [weekday, start, end] of blocks) {
                    await client.query(
                        'INSERT INTO availability (staff_id, service_id, weekday, start_clock, end_clock) VALUES ($1, $2, $3, $4, $5)',
                        [staffId, serviceIds[service], weekday, start, end]
                    );
                }
            }
        }

        await client.query(
            `INSERT INTO users (full_name, email, password_hash, role, student_id, course) VALUES ('Mark Santos', 'marksantos@wmsu.edu.ph', $1, 'student', '2023-00001', 'BS Computer Science')
             ON CONFLICT (email) DO NOTHING`,
            [studentHash]
        );
    });
    console.log(`Demo data ready (${added} new staff added, ${SERVICES.length} services available).`);
    console.log('  admin@wmsu.edu.ph / admin123');
    console.log('  staff: reyes@, santos@, cruz@, delacruz@, villanueva@, mendoza@, garcia@, ramos@, aquino@, bautista@, lim@, flores@wmsu.edu.ph / staff123');
    console.log('  student: marksantos@wmsu.edu.ph / student123');
}

main()
    .catch((err) => { console.error('Could not seed demo data:', err.message); process.exitCode = 1; })
    .finally(() => pool.end());
