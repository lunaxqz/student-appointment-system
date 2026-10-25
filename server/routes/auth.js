const express = require('express');
const { body } = require('express-validator');
const validate = require('../utils/validate');
const { authenticate } = require('../middleware/auth');
const { login, me, register, changePassword } = require('../controllers/authController');

const router = express.Router();

router.post(
    '/login',
    validate([
        body('email').isString().trim().notEmpty().withMessage('Email is required.'),
        body('password').isString().notEmpty().withMessage('Password is required.'),
    ]),
    login
);
router.get('/me', authenticate, me);

router.post(
    '/register',
    validate([
        body('full_name').isString().trim().isLength({ min: 1, max: 100 }).withMessage('Full name is required (100 characters max).'),
        body('email').isString().trim().isEmail().isLength({ max: 150 }).withMessage('A valid email is required.'),
        body('password').isString().isLength({ min: 6, max: 72 }).withMessage('Password must be 6 to 72 characters.'),
        body('role').isIn(['student', 'staff']).withMessage('Role must be student or staff.'),
        body('student_id').if(body('role').equals('student')).isString().trim().isLength({ min: 1, max: 30 }).withMessage('Student ID is required (30 characters max).'),
        body('course').if(body('role').equals('student')).isString().trim().isLength({ min: 1, max: 100 }).withMessage('Course is required (100 characters max).'),
    ]),
    register
);

router.patch(
    '/password',
    authenticate,
    validate([
        body('current_password').isString().notEmpty().withMessage('Current password is required.'),
        body('new_password').isString().isLength({ min: 6, max: 72 }).withMessage('New password must be 6 to 72 characters.'),
    ]),
    changePassword
);

module.exports = router;
