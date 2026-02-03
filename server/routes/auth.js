import { Router } from 'express';
import bcrypt from 'bcrypt';
import { userQueries, accessQueries, connectionQueries } from '../db/meta.js';
import { generateToken, authMiddleware } from '../middleware/auth.js';
import { getRolePermissions } from '../middleware/rbac.js';

const router = Router();

/**
 * POST /api/auth/login
 * Authenticate user and return JWT token
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        // Find user by email
        const user = userQueries.findByEmail.get(email);

        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        if (!user.is_active) {
            return res.status(401).json({ error: 'Account is disabled' });
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password_hash);

        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Generate token
        const token = generateToken(user);

        // Get user's allowed databases
        const allowedDatabases = accessQueries.getUserDatabases.all(user.id);

        // Get role permissions
        const permissions = getRolePermissions(user.role);

        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            },
            allowedDatabases,
            permissions
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

/**
 * GET /api/auth/me
 * Get current authenticated user info
 */
router.get('/me', authMiddleware, (req, res) => {
    try {
        // Get user's allowed databases
        let allowedDatabases;
        if (req.user.role === 'ADMIN') {
            allowedDatabases = connectionQueries.findAll.all();
            // Filter to only active ones for the selector
            allowedDatabases = allowedDatabases.filter(db => db.is_active);
        } else {
            allowedDatabases = accessQueries.getUserDatabases.all(req.user.id);
        }

        // Get role permissions
        const permissions = getRolePermissions(req.user.role);

        res.json({
            user: req.user,
            allowedDatabases,
            permissions
        });

    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user info' });
    }
});

/**
 * POST /api/auth/logout
 * Logout (client should discard token)
 */
router.post('/logout', authMiddleware, (req, res) => {
    // JWT tokens are stateless, client should discard the token
    res.json({ message: 'Logged out successfully' });
});

/**
 * PUT /api/auth/password
 * Change own password
 */
router.put('/password', authMiddleware, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current and new password required' });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        // Get full user data with password hash
        const user = userQueries.findByEmail.get(req.user.email);

        // Verify current password
        const validPassword = await bcrypt.compare(currentPassword, user.password_hash);

        if (!validPassword) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        // Hash new password
        const newPasswordHash = await bcrypt.hash(newPassword, 12);

        // Update password
        userQueries.updatePassword.run(newPasswordHash, req.user.id);

        res.json({ message: 'Password updated successfully' });

    } catch (error) {
        console.error('Password change error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

export default router;
