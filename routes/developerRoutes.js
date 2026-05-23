import { Router } from 'express';
import { assignedTickets, dashboard, ticketDetail, updateTicket } from '../controllers/developerController.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';

const router = Router();
router.use(requireAuth, requireRole('developer'));

router.get('/dashboard', dashboard);
router.get('/tickets', assignedTickets);
router.get('/tickets/:id', ticketDetail);
router.post('/tickets/:id', upload.single('proof'), updateTicket);

export default router;
