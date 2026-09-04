import express from 'express';
import { getDashboardAnalytics } from '../controller/analyticsController.js';
import { authenticateToken } from '../middleware/authenticate.js';

const router = express.Router();

// Single cached, role-scoped payload for the whole dashboard.
router.get('/dashboard', authenticateToken, getDashboardAnalytics);

export default router;
