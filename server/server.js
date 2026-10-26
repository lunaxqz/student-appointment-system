
const express = require('express');
const cors = require('cors');
const pool = require('./db');
const errorHandler = require('./middleware/errorHandler');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const schedulingRoutes = require('./routes/scheduling');
const appointmentRoutes = require('./routes/appointments');
const ensureDemoAdmin = require('./utils/demoAdmin');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Test route
app.get('/', (req, res) => {
    res.send('Student Appointment System API is running!');
});

app.get('/api/db-test', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({
            message: 'Database connected successfully!',
            time: result.rows[0].now,
        });
    } catch (error) {
        console.error('Database connection error:', error.message);
        res.status(500).json({
            message: 'Database connection failed.',
        });
    }
});

// Feature routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api', schedulingRoutes);

// Error-handling middleware
app.use(errorHandler);

// Start the server (skipped when the file is imported by the tests)
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
        ensureDemoAdmin().catch((err) => console.warn('Could not check for the demo admin:', err.message));
    });
}

module.exports = app;