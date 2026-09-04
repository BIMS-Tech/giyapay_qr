import express from 'express';
import { addAdmin, countAdmins, getAllAdmins, adminEmailCheck } from '../controller/adminController.js';
import { authenticateToken } from '../middleware/authenticate.js';

const router = express.Router();

// Every route here was previously unauthenticated. /all returned every
// merchant_secret to anonymous callers, and those secrets sign the payment
// gateway requests, so this was a live credential leak. /add let anyone
// create a merchant admin account.
router.post('/add', authenticateToken, addAdmin);

router.get('/count', authenticateToken, countAdmins);

router.get('/all', authenticateToken, getAllAdmins);

router.get('/check-email/:email', authenticateToken, adminEmailCheck);

export default router;
