import { Router } from 'express';
import bcrypt from 'bcrypt';
import { userQueries, accessQueries } from '../db/meta.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/rbac.js';

const router = Router();

// All routes require authentication and admin role
router.use(authMiddleware);
router.use(requireAdmin);

/**
 * GET /api/users
 * List all users
 */
router.get('/', (req, res) => {
    try {
        const users = userQueries.findAll.all();
        res.json(users);
    } catch (error) {
        console.error('List users error:', error);
        res.status(500).json({ error: 'Failed to list users' });
    }
});

/**
 * GET /api/users/:id
 * Get single user by ID
 */
router.get('/:id', (req, res) => {
    try {
        const user = userQueries.findById.get(parseInt(req.params.id));

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get user's database access
        const databases = accessQueries.getUserDatabases.all(user.id);

        res.json({ ...user, databases });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user' });
    }
});

/**
 * POST /api/users
 * Create new user
 */
router.post('/', async (req, res) => {
    try {
        const { email, password, name, role } = req.body;

        // Validation
        if (!email || !password || !name || !role) {
            return res.status(400).json({ error: 'Email, password, name, and role are required' });
        }

        if (!['ADMIN', 'DEVELOPER', 'ANALYST'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role. Must be ADMIN, DEVELOPER, or ANALYST' });
        }

        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        // Check if email already exists
        const existing = userQueries.findByEmail.get(email);
        if (existing) {
            return res.status(409).json({ error: 'Email already exists' });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 12);

        // Create user
        const result = userQueries.create.run(email, passwordHash, name, role);

        res.status(201).json({
            id: result.lastInsertRowid,
            email,
            name,
            role,
            is_active: 1
        });

    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

/**
 * PUT /api/users/:id
 * Update user
 */
router.put('/:id', (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { name, role, is_active } = req.body;

        // Get existing user
        const user = userQueries.findById.get(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Prevent disabling the last admin
        if (user.role === 'ADMIN' && (role !== 'ADMIN' || is_active === 0)) {
            const admins = userQueries.findAll.all().filter(u => u.role === 'ADMIN' && u.is_active);
            if (admins.length <= 1) {
                return res.status(400).json({ error: 'Cannot disable or demote the last admin' });
            }
        }

        // Update user
        userQueries.update.run(
            name || user.name,
            role || user.role,
            is_active !== undefined ? is_active : user.is_active,
            userId
        );

        res.json({
            id: userId,
            name: name || user.name,
            role: role || user.role,
            is_active: is_active !== undefined ? is_active : user.is_active
        });

    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

/**
 * DELETE /api/users/:id
 * Disable user (soft delete)
 */
router.delete('/:id', (req, res) => {
    try {
        const userId = parseInt(req.params.id);

        // Prevent self-deletion
        if (userId === req.user.id) {
            return res.status(400).json({ error: 'Cannot delete yourself' });
        }

        const user = userQueries.findById.get(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Prevent deleting last admin
        if (user.role === 'ADMIN') {
            const admins = userQueries.findAll.all().filter(u => u.role === 'ADMIN' && u.is_active);
            if (admins.length <= 1) {
                return res.status(400).json({ error: 'Cannot delete the last admin' });
            }
        }

        userQueries.delete.run(userId);

        res.json({ message: 'User disabled successfully' });

    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

/**
 * POST /api/users/:id/database-access
 * Grant database access to user
 */
router.post('/:id/database-access', (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { connectionId } = req.body;

        if (!connectionId) {
            return res.status(400).json({ error: 'Connection ID required' });
        }

        accessQueries.grantAccess.run(userId, connectionId);

        res.json({ message: 'Database access granted' });

    } catch (error) {
        console.error('Grant access error:', error);
        res.status(500).json({ error: 'Failed to grant access' });
    }
});

/**
 * DELETE /api/users/:id/database-access/:connectionId
 * Revoke database access from user
 */
router.delete('/:id/database-access/:connectionId', (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const connectionId = parseInt(req.params.connectionId);

        accessQueries.revokeAccess.run(userId, connectionId);

        res.json({ message: 'Database access revoked' });

    } catch (error) {
        console.error('Revoke access error:', error);
        res.status(500).json({ error: 'Failed to revoke access' });
    }
});

export default router;
