import { Router } from 'express';
import { logQueries } from '../db/meta.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/rbac.js';

const router = Router();

router.use(authMiddleware);

/**
 * GET /api/logs
 * Get query logs (admins see all, others see own)
 */
router.get('/', (req, res) => {
    try {
        let logs;

        if (req.user.role === 'ADMIN') {
            logs = logQueries.findAll.all();
        } else {
            logs = logQueries.findByUser.all(req.user.id);
        }

        res.json(logs);
    } catch (error) {
        console.error('Get logs error:', error);
        res.status(500).json({ error: 'Failed to get logs' });
    }
});

/**
 * GET /api/logs/user/:userId
 * Get logs for specific user (admin only)
 */
router.get('/user/:userId', requireAdmin, (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        const logs = logQueries.findByUser.all(userId);
        res.json(logs);
    } catch (error) {
        console.error('Get user logs error:', error);
        res.status(500).json({ error: 'Failed to get user logs' });
    }
});

export default router;
