import jwt from 'jsonwebtoken';
import { userQueries } from '../db/meta.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '8h';

/**
 * Generate JWT token for a user
 * @param {Object} user - User object
 * @returns {string} - JWT token
 */
export function generateToken(user) {
    return jwt.sign(
        {
            userId: user.id,
            email: user.email,
            role: user.role
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

/**
 * Verify JWT token
 * @param {string} token - JWT token
 * @returns {Object|null} - Decoded token payload or null
 */
export function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
}

/**
 * Authentication middleware
 * Extracts and verifies JWT from Authorization header
 */
export function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    if (!decoded) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Fetch fresh user data
    const user = userQueries.findById.get(decoded.userId);

    if (!user || !user.is_active) {
        return res.status(401).json({ error: 'User not found or disabled' });
    }

    // Attach user to request
    req.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
    };

    next();
}

/**
 * Optional auth middleware (doesn't fail if no token)
 */
export function optionalAuthMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const decoded = verifyToken(token);

        if (decoded) {
            const user = userQueries.findById.get(decoded.userId);
            if (user && user.is_active) {
                req.user = {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role
                };
            }
        }
    }

    next();
}
