import { Router } from 'express';
import { body } from 'express-validator';
import { createDeveloper, dashboard, developers, exportTickets, reinviteDeveloper, reports, resetDeveloperPassword, setDeveloperState, ticketDetail, tickets, updateTicket } from '../controllers/adminController.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validationMiddleware.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

router.get('/dashboard', dashboard);
router.get('/tickets', tickets);
router.get('/tickets/export', exportTickets);
router.get('/tickets/:id', ticketDetail);
router.post('/tickets/:id', updateTicket);
router.get('/developers', developers);
router.post('/developers', [body('name').notEmpty(), body('email').isEmail()], validate, createDeveloper);
router.post('/developers/:id/reinvite', reinviteDeveloper);
router.post('/developers/:id/state', setDeveloperState);
router.post('/developers/:id/password', [body('password').isLength({ min: 8 }).withMessage('Minimum 8 character password required')], validate, resetDeveloperPassword);
router.get('/reports', reports);

export default router;
