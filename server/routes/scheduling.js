// Read-only catalogue (services, faculty, bookable slots) for any signed-in user,
// (each route checks the sign-in itself, so unknown /api paths still answer 404), plus weekly availability that faculty manage for themselves and administrators manage for anyone.
const express = require('express');
const { body, param, query } = require('express-validator');
const validate = require('../utils/validate');
const { authenticate, requireRole } = require('../middleware/auth');
const c = require('../controllers/schedulingController');

const router = express.Router();

const id = param('id').isInt({ min: 1 }).withMessage('Invalid id.');
const time = (field) => body(field).isString().matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage(`${field} must be a time like 09:30.`);

router.get('/services', authenticate, c.listServices);

router.get('/faculty', authenticate, validate([
    query('service').optional().isInt({ min: 1 }).withMessage('Invalid service.'),
]), c.listFaculty);

router.get('/faculty/:id/slots', authenticate, validate([
    id,
    query('service').optional().isInt({ min: 1 }).withMessage('Invalid service.'),
    query('days').optional().isInt({ min: 1, max: 60 }).withMessage('days must be between 1 and 60.'),
]), c.listSlots);

router.get('/staff/:id/schedule', authenticate, requireRole('staff', 'admin'), validate([
    id,
    query('from').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('from must be a date like 2026-11-02.'),
    query('to').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('to must be a date like 2026-11-08.'),
]), c.getSchedule);

router.post('/availability', authenticate, requireRole('staff', 'admin'), validate([
    body('service_id').isInt({ min: 1 }).withMessage('Choose a service.'),
    body('weekday').isInt({ min: 0, max: 6 }).withMessage('weekday must be 0 (Sunday) to 6 (Saturday).'),
    time('start'),
    time('end'),
    body('staff_id').optional().isInt({ min: 1 }).withMessage('Invalid faculty member.'),
]), c.addBlock);

router.delete('/availability/:id', authenticate, requireRole('staff', 'admin'), validate([id]), c.removeBlock);

module.exports = router;
