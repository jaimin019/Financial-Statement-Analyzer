import { Router } from 'express';
import User from '../models/User.js';
import Session from '../models/Session.js';
import RawTransaction from '../models/RawTransaction.js';
import { authenticate } from '../middleware/authenticate.js';
import { adminOnly } from '../middleware/adminOnly.js';

const router = Router();

/**
 * GET /api/admin/stats
 * Returns system-wide statistics for the admin dashboard.
 * Defense-in-depth: middleware also applied at mount level in index.js.
 */
router.get('/stats', authenticate, adminOnly, async (req, res) => {
  try {
    const [
      totalUsers,
      totalSessions,
      totalTransactions,
      recentUsers
    ] = await Promise.all([
      User.countDocuments(),
      Session.countDocuments(),
      RawTransaction.countDocuments(),
      User.find({}, 'email displayName authProvider createdAt lastLoginAt isAdmin')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean()
    ]);

    res.json({
      metrics: {
        totalUsers,
        totalSessions,
        totalTransactions,
      },
      recentUsers
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ error: 'Failed to retrieve admin stats' });
  }
});

export default router;
