
const express = require('express');
const cors = require('cors');
const pool = require('./db');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = 5000;

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

// Error-handling middleware
app.use(errorHandler);

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});