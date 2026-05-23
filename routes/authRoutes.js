import { Router } from 'express';
import { body } from 'express-validator';
import { acceptInvite, forgotPassword, login, logout, resetPassword, showAcceptInvite, showForgotPassword, showLogin, showResetPassword } from '../controllers/authController.js';
import { validate } from '../middleware/validationMiddleware.js';
import { authLimiter } from '../middleware/rateLimiters.js';

const router = Router();

router.get('/login', showLogin);
router.post('/login', authLimiter, [body('email').isEmail().withMessage('Valid email is required'), body('password').notEmpty().withMessage('Password is required')], validate, login);
router.get('/forgot-password', showForgotPassword);
router.post('/forgot-password', authLimiter, [body('email').isEmail().withMessage('Valid email is required')], validate, forgotPassword);
router.get('/reset-password/:token', showResetPassword);
router.post('/reset-password/:token', authLimiter, [body('password').isLength({ min: 8 }).withMessage('Minimum 8 character password required')], validate, resetPassword);
router.get('/accept-invite/:token', showAcceptInvite);
router.post('/accept-invite/:token', authLimiter, [body('password').isLength({ min: 8 }).withMessage('Minimum 8 character password required')], validate, acceptInvite);
router.post('/logout', logout);

export default router;
