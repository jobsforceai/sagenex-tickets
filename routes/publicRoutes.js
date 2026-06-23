import { Router } from 'express';
import { body } from 'express-validator';
import { home, printTicket, reopenTicket, showComplaint, submitComplaint, trackTicket, verifySgxUser } from '../controllers/publicController.js';
import { upload } from '../middleware/uploadMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';
import { validateComplaintCaptcha } from '../middleware/captchaMiddleware.js';
import { complaintSubmitLimiter, complaintVerifyLimiter, complaintViewLimiter, trackingLimiter } from '../middleware/rateLimiters.js';
import { platformKeys } from '../utils/platforms.js';

const router = Router();

router.get('/', home);
router.get('/complaint', complaintViewLimiter, showComplaint);
router.post('/complaint/verify-user', complaintVerifyLimiter, [body('externalUserId').trim().notEmpty().withMessage('SGX user ID is required')], verifySgxUser);
router.post(
  '/complaint',
  complaintSubmitLimiter,
  upload.array('attachments', 3),
  validateComplaintCaptcha,
  [
    body('complainantType').isIn(['sgx_member', 'public']).withMessage('Select a valid user type'),
    body('memberConfirmed').if(body('complainantType').equals('sgx_member')).equals('yes').withMessage('Please verify and confirm the SGX member profile'),
    body('externalUserId').if(body('complainantType').equals('sgx_member')).trim().notEmpty().withMessage('SGX member user ID is required'),
    body('name').if(body('complainantType').equals('public')).trim().notEmpty().withMessage('Name is required'),
    body('email').if(body('complainantType').equals('public')).isEmail().withMessage('Valid email is required'),
    body('phone').if(body('complainantType').equals('public')).trim().notEmpty().withMessage('Phone is required'),
    body('platform').isIn(platformKeys()).withMessage('Select a valid SGX platform'),
    body('title').trim().isLength({ min: 4, max: 120 }).withMessage('Complaint title is required'),
    body('description').trim().isLength({ min: 10 }).withMessage('Description must be at least 10 characters'),
    body('website').isEmpty().withMessage('Spam protection blocked this request')
  ],
  validate,
  submitComplaint
);
router.get('/track', trackingLimiter, trackTicket);
router.post('/tickets/:ticketId/reopen', reopenTicket);
router.get('/tickets/:ticketId/print', printTicket);

export default router;
