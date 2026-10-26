// Students book and cancel; faculty answer requests. Both only ever see their own appointments.
const express = require('express');
const { body, param } = require('express-validator');
const validate = require('../utils/validate');
const { authenticate, requireRole } = require('../middleware/auth');
const { isDate, isTime } = require('../utils/campusTime');
const c = require('../controllers/appointmentController');

const router = express.Router();

const STATUSES = ['pending', 'approved', 'rejected', 'cancelled', 'completed'];

router.get('/', authenticate, requireRole('student', 'staff'), c.list);

router.post('/', authenticate, requireRole('student'), validate([
    body('staff_id').isInt({ min: 1 }).withMessage('Choose a faculty member.'),
    body('service_id').isInt({ min: 1 }).withMessage('Choose a service.'),
    body('date').custom(isDate).withMessage('Choose a valid date.'),
    body('time').custom(isTime).withMessage('Choose a valid time.'),
    body('reason').optional({ values: 'null' }).isString().isLength({ max: 1000 }).withMessage('The reason is limited to 1000 characters.'),
]), c.book);

router.patch('/:id/status', authenticate, requireRole('student', 'staff'), validate([
    param('id').isInt({ min: 1 }).withMessage('Invalid id.'),
    body('status').isIn(STATUSES).withMessage('Unknown status.'),
    body('notes').optional().isString().isLength({ max: 500 }).withMessage('Notes are limited to 500 characters.'),
]), c.changeStatus);

module.exports = router;
