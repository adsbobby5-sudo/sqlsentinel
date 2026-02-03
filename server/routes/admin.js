import { Router } from 'express';
import bcrypt from 'bcrypt';
import { userQueries, accessQueries, permissionQueries, logQueries } from '../db/meta.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/rbac.js';

const router = Router();

// All admin routes require authentication and admin role
router.use(authMiddleware);
router.use(requireAdmin);

/**
 * GET /api/admin/users
 * List all users
 */
router.get('/users', (req, res) => {
    try {
        const users = userQueries.findAll.all();
        res.json(users);
    } catch (error) {
        console.error('List users error:', error);
        res.status(500).json({ error: 'Failed to list users' });
    }
});

/**
 * POST /api/admin/users
 * Create a new user
 */
router.post('/users', async (req, res) => {
    try {
        const { email, password, name, role } = req.body;

        if (!email || !password || !name) {
            return res.status(400).json({ error: 'Email, password, and name are required' });
        }

        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        const validRoles = ['ADMIN', 'DEVELOPER', 'ANALYST'];
        const userRole = validRoles.includes(role) ? role : 'ANALYST';

        // Check if email already exists
        const existing = userQueries.findByEmail.get(email);
        if (existing) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 12);

        // Create user
        const result = userQueries.create.run(email, passwordHash, name, userRole);

        res.status(201).json({
            id: result.lastInsertRowid,
            email,
            name,
            role: userRole,
            message: 'User created successfully'
        });

    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

/**
 * PUT /api/admin/users/:id
 * Update user details
 */
router.put('/users/:id', (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { name, role, is_active } = req.body;

        // Get current user
        const user = userQueries.findById.get(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Prevent self-demotion
        if (userId === req.user.id && role && role !== 'ADMIN') {
            return res.status(400).json({ error: 'Cannot demote yourself' });
        }

        // Prevent self-deactivation
        if (userId === req.user.id && is_active === 0) {
            return res.status(400).json({ error: 'Cannot deactivate yourself' });
        }

        const validRoles = ['ADMIN', 'DEVELOPER', 'ANALYST'];
        const newRole = role && validRoles.includes(role) ? role : user.role;
        const newName = name || user.name;
        const newActive = is_active !== undefined ? is_active : user.is_active;

        userQueries.update.run(newName, newRole, newActive, userId);

        res.json({
            success: true,
            message: 'User updated successfully'
        });

    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

/**
 * DELETE /api/admin/users/:id
 * Soft-delete (deactivate) a user
 */
router.delete('/users/:id', (req, res) => {
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

        userQueries.delete.run(userId);

        res.json({
            success: true,
            message: 'User deactivated successfully'
        });

    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

/**
 * POST /api/admin/users/:id/reset-password
 * Reset user password
 */
router.post('/users/:id/reset-password', async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { newPassword } = req.body;

        if (!newPassword || newPassword.length < 8) {
            return res.status(400).json({ error: 'New password must be at least 8 characters' });
        }

        const user = userQueries.findById.get(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const passwordHash = await bcrypt.hash(newPassword, 12);
        userQueries.updatePassword.run(passwordHash, userId);

        res.json({
            success: true,
            message: 'Password reset successfully'
        });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

/**
 * GET /api/admin/permissions
 * Get all role permissions
 */
router.get('/permissions', (req, res) => {
    try {
        const roles = ['ADMIN', 'DEVELOPER', 'ANALYST'];
        const permissions = {};

        for (const role of roles) {
            permissions[role] = permissionQueries.getByRole.all(role);
        }

        res.json(permissions);

    } catch (error) {
        console.error('Get permissions error:', error);
        res.status(500).json({ error: 'Failed to get permissions' });
    }
});

/**
 * PUT /api/admin/permissions
 * Update role permissions
 */
router.put('/permissions', (req, res) => {
    try {
        const { role, operation, is_allowed, max_rows } = req.body;

        const validRoles = ['ADMIN', 'DEVELOPER', 'ANALYST'];
        const validOps = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'JOIN', 'CTE'];

        if (!validRoles.includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        if (!validOps.includes(operation)) {
            return res.status(400).json({ error: 'Invalid operation' });
        }

        // Prevent removing all permissions from admin
        if (role === 'ADMIN' && is_allowed === 0) {
            return res.status(400).json({ error: 'Cannot remove permissions from ADMIN role' });
        }

        permissionQueries.update.run(
            is_allowed ? 1 : 0,
            max_rows || 1000,
            role,
            operation
        );

        res.json({
            success: true,
            message: 'Permission updated successfully'
        });

    } catch (error) {
        console.error('Update permission error:', error);
        res.status(500).json({ error: 'Failed to update permission' });
    }
});

/**
 * GET /api/admin/logs
 * Get query execution logs
 */
router.get('/logs', (req, res) => {
    try {
        const logs = logQueries.findAll.all();
        res.json(logs);
    } catch (error) {
        console.error('Get logs error:', error);
        res.status(500).json({ error: 'Failed to get logs' });
    }
});

/**
 * GET /api/admin/users/:id/databases
 * Get databases a user has access to
 */
router.get('/users/:id/databases', (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const databases = accessQueries.getUserDatabases.all(userId);
        res.json(databases);
    } catch (error) {
        console.error('Get user databases error:', error);
        res.status(500).json({ error: 'Failed to get user databases' });
    }
});

export default router;
