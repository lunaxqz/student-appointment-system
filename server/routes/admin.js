// Every route in this file requires a signed-in, active administrator.
const express = require('express');
const { body, param, query } = require('express-validator');
const validate = require('../utils/validate');
const { authenticate, requireRole } = require('../middleware/auth');
const c = require('../controllers/adminController');
const staff = require('../controllers/adminStaffController');

const router = express.Router();
router.use(authenticate, requireRole('admin'));

const ROLES = ['student', 'staff', 'admin'];
const id = param('id').isInt({ min: 1 }).withMessage('Invalid id.');
const paging = [
    query('page').optional().isInt({ min: 1 }).withMessage('page must be 1 or more.'),
    query('pageSize').optional().isInt({ min: 1, max: 100 }).withMessage('pageSize must be between 1 and 100.'),
    query('q').optional().isString().isLength({ max: 100 }).withMessage('Search text is too long.'),
];

router.get('/dashboard', c.dashboard);

router.get('/users', validate([
    ...paging,
    query('role').optional().isIn(ROLES).withMessage('Unknown role.'),
    query('status').optional().isIn(['active', 'inactive']).withMessage('status must be active or inactive.'),
]), c.listUsers);

router.post('/users', validate([
    body('full_name').isString().trim().isLength({ min: 1, max: 100 }).withMessage('Full name is required (100 characters max).'),
    body('email').isString().trim().isEmail().isLength({ max: 150 }).withMessage('A valid email is required.'),
    body('password').isString().isLength({ min: 6, max: 72 }).withMessage('Password must be 6 to 72 characters.'),
    body('role').isIn(ROLES).withMessage('Role must be student, staff or admin.'),
    body('title').optional().isString().trim().isLength({ max: 100 }).withMessage('Title is limited to 100 characters.'),
    body('dept').optional().isString().trim().isLength({ max: 100 }).withMessage('Office / department is limited to 100 characters.'),
]), c.createUser);

router.patch('/users/:id', validate([
    id,
    body('role').optional().isIn(ROLES).withMessage('Role must be student, staff or admin.'),
    body('is_active').optional().isBoolean({ strict: true }).withMessage('is_active must be true or false.'),
    body().custom((b) => b.role !== undefined || b.is_active !== undefined).withMessage('Provide a role or is_active to change.'),
]), c.updateUser);

router.delete('/users/:id', validate([id]), c.deleteUser);

router.get('/appointments', validate([
    ...paging,
    query('status').optional().isIn(c.STATUSES).withMessage('Unknown status.'),
    query('service').optional().isInt({ min: 1 }).withMessage('Invalid service.'),
]), c.listAppointments);

router.patch('/appointments/:id/status', validate([
    id,
    body('status').isIn(c.STATUSES).withMessage('Unknown status.'),
    body('notes').optional().isString().isLength({ max: 500 }).withMessage('Notes are limited to 500 characters.'),
]), c.changeAppointmentStatus);

// ---------- faculty, services and who offers what ----------

router.get('/staff', staff.listStaff);

router.patch('/staff/:id', validate([
    id,
    body('title').optional().isString().trim().isLength({ max: 100 }).withMessage('Title is limited to 100 characters.'),
    body('dept').optional().isString().trim().isLength({ max: 100 }).withMessage('Office / department is limited to 100 characters.'),
    body('bio').optional().isString().trim().isLength({ max: 1000 }).withMessage('Bio is limited to 1000 characters.'),
]), staff.updateProfile);

router.put('/staff/:id/services', validate([
    id,
    body('service_ids').isArray({ max: 100 }).withMessage('service_ids must be a list.'),
    body('service_ids.*').isInt({ min: 1 }).withMessage('Invalid service id.'),
]), staff.setServices);

router.post('/services', validate([
    body('name').isString().trim().isLength({ min: 1, max: 100 }).withMessage('Service name is required (100 characters max).'),
]), staff.createService);

router.delete('/services/:id', validate([id]), staff.deleteService);

module.exports = router;
