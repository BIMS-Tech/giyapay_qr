import express from 'express';
import crypto from 'crypto';
import checkTransactions from '../middleware/checkTransactions.js';

const router = express.Router();

/**
 * Endpoints driven by Cloud Scheduler rather than by a user.
 *
 * The service is deployed --allow-unauthenticated (the payment callbacks need
 * to reach it), so these are guarded by a shared secret instead of IAM.
 */
const authorizeCron = (req, res, next) => {
  const expected = process.env.CRON_SECRET;

  // Fail closed: without a configured secret the endpoint stays shut rather
  // than falling back to being open.
  if (!expected) {
    console.error('CRON_SECRET is not set; refusing the scheduled trigger.');
    return res.status(503).json({ error: 'Scheduler not configured' });
  }

  const provided = req.headers['x-cron-key'];
  if (typeof provided !== 'string' || provided.length !== expected.length) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Constant-time compare so the secret cannot be recovered by timing.
  const match = crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  if (!match) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  return next();
};

router.post('/check-transactions', authorizeCron, async (req, res) => {
  // The job is bounded (200 rows, 8 concurrent calls, 10s each), so it
  // finishes well inside the scheduler's deadline and can answer with counts.
  const result = await checkTransactions(req.app.get('socketio'));
  return res.json({ ok: true, ...result });
});

export default router;
