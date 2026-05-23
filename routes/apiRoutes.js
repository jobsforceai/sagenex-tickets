import { Router } from 'express';
import cors from 'cors';
import { getConfig, verifyUser, submitComplaint, trackTicket } from '../controllers/apiController.js';
import { upload } from '../middleware/uploadMiddleware.js';

const router = Router();

// Enable CORS for all API routes (origin: * represents public access from any platform report/website)
router.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

router.get('/chatbot/config', getConfig);
router.post('/chatbot/verify-user', verifyUser);
router.post('/chatbot/complaint', upload.array('attachments', 3), submitComplaint);
router.get('/chatbot/track', trackTicket);


export default router;
