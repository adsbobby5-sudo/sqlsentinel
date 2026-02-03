import { Router } from 'express';
import { connectionQueries, accessQueries } from '../db/meta.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/rbac.js';
import { encrypt } from '../utils/encryption.js';
import { testConnection, closePool } from '../utils/connectionPool.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /api/connections
 * List database connections
 * - Admins see all connections
 * - Other users see only their assigned connections
 */
router.get('/', (req, res) => {
    try {
        let connections;

        if (req.user.role === 'ADMIN') {
            connections = connectionQueries.findAll.all();
        } else {
            connections = accessQueries.getUserDatabases.all(req.user.id);
        }

        // Never expose passwords
        const safeConnections = connections.map(conn => ({
            id: conn.id,
            name: conn.name,
            db_type: conn.db_type,
            host: conn.host,
            port: conn.port,
            database_name: conn.database_name,
            username: conn.username,
            is_active: conn.is_active,
            created_at: conn.created_at
        }));

        res.json(safeConnections);

    } catch (error) {
        console.error('List connections error:', error);
        res.status(500).json({ error: 'Failed to list database connections' });
    }
});

/**
 * GET /api/connections/:id
 * Get single connection details (admin only for full details)
 */
router.get('/:id', (req, res) => {
    try {
        const connectionId = parseInt(req.params.id);
        const connection = connectionQueries.findById.get(connectionId);

        if (!connection) {
            return res.status(404).json({ error: 'Connection not found' });
        }

        // Check access for non-admins
        if (req.user.role !== 'ADMIN') {
            const hasAccess = accessQueries.hasAccess.get(req.user.id, connectionId);
            if (!hasAccess) {
                return res.status(403).json({ error: 'Access denied to this database' });
            }
        }

        // Return safe version (no password)
        res.json({
            id: connection.id,
            name: connection.name,
            db_type: connection.db_type,
            host: connection.host,
            port: connection.port,
            database_name: connection.database_name,
            username: connection.username,
            is_active: connection.is_active,
            created_at: connection.created_at
        });

    } catch (error) {
        console.error('Get connection error:', error);
        res.status(500).json({ error: 'Failed to get connection' });
    }
});

/**
 * POST /api/connections
 * Create a new database connection (admin only)
 */
router.post('/', requireAdmin, (req, res) => {
    try {
        const { name, db_type, host, port, database_name, username, password } = req.body;

        // Validate required fields
        if (!name || !db_type || !host || !port || !database_name || !username || !password) {
            return res.status(400).json({ error: 'All connection fields are required' });
        }

        const validTypes = ['ORACLE', 'MYSQL', 'POSTGRESQL'];
        if (!validTypes.includes(db_type.toUpperCase())) {
            return res.status(400).json({ error: `Invalid database type. Must be one of: ${validTypes.join(', ')}` });
        }

        // Check for duplicate name
        const existing = connectionQueries.findByName.get(name);
        if (existing) {
            return res.status(409).json({ error: 'Connection name already exists' });
        }

        // Encrypt password
        const encryptedPassword = encrypt(password);

        // Create connection
        const result = connectionQueries.create.run(
            name,
            db_type.toUpperCase(),
            host,
            parseInt(port),
            database_name,
            username,
            encryptedPassword,
            req.user.id
        );

        // Auto-grant access to the creator (Admin) so they can see it immediately
        accessQueries.grantAccess.run(req.user.id, result.lastInsertRowid);

        res.status(201).json({
            id: result.lastInsertRowid,
            name,
            message: 'Database connection created successfully'
        });

    } catch (error) {
        console.error('Create connection error:', error);
        res.status(500).json({ error: 'Failed to create database connection' });
    }
});

/**
 * PUT /api/connections/:id
 * Update a database connection (admin only)
 */
router.put('/:id', requireAdmin, async (req, res) => {
    try {
        const connectionId = parseInt(req.params.id);
        const { name, db_type, host, port, database_name, username, password, is_active } = req.body;

        const connection = connectionQueries.findById.get(connectionId);
        if (!connection) {
            return res.status(404).json({ error: 'Connection not found' });
        }

        const validTypes = ['ORACLE', 'MYSQL', 'POSTGRESQL'];
        const newType = db_type && validTypes.includes(db_type.toUpperCase())
            ? db_type.toUpperCase()
            : connection.db_type;

        // Update connection details
        connectionQueries.update.run(
            name || connection.name,
            newType,
            host || connection.host,
            port ? parseInt(port) : connection.port,
            database_name || connection.database_name,
            username || connection.username,
            is_active !== undefined ? is_active : connection.is_active,
            connectionId
        );

        // Update password if provided
        if (password) {
            const encryptedPassword = encrypt(password);
            connectionQueries.updatePassword.run(encryptedPassword, connectionId);
        }

        // Close existing pool so it reconnects with new settings
        await closePool(connectionId);

        res.json({
            success: true,
            message: 'Database connection updated successfully'
        });

    } catch (error) {
        console.error('Update connection error:', error);
        res.status(500).json({ error: 'Failed to update database connection' });
    }
});

/**
 * DELETE /api/connections/:id
 * Delete a database connection (admin only)
 */
router.delete('/:id', requireAdmin, async (req, res) => {
    try {
        const connectionId = parseInt(req.params.id);

        const connection = connectionQueries.findById.get(connectionId);
        if (!connection) {
            return res.status(404).json({ error: 'Connection not found' });
        }

        // Close pool first
        await closePool(connectionId);

        // Delete connection (cascades to user_db_access)
        connectionQueries.delete.run(connectionId);

        res.json({
            success: true,
            message: 'Database connection deleted successfully'
        });

    } catch (error) {
        console.error('Delete connection error:', error);
        res.status(500).json({ error: 'Failed to delete database connection' });
    }
});

/**
 * POST /api/connections/:id/test
 * Test a database connection
 */
router.post('/:id/test', requireAdmin, async (req, res) => {
    try {
        const connectionId = parseInt(req.params.id);

        const connection = connectionQueries.findById.get(connectionId);
        if (!connection) {
            return res.status(404).json({ error: 'Connection not found' });
        }

        const result = await testConnection(connection);

        if (result.success) {
            res.json({ connected: true, message: 'Connection successful' });
        } else {
            res.json({ connected: false, error: result.error });
        }

    } catch (error) {
        console.error('Test connection error:', error);
        res.status(500).json({ connected: false, error: error.message });
    }
});

/**
 * POST /api/connections/test-new
 * Test a new connection configuration before saving
 */
router.post('/test-new', requireAdmin, async (req, res) => {
    try {
        const { db_type, host, port, database_name, username, password } = req.body;

        if (!db_type || !host || !port || !database_name || !username || !password) {
            return res.status(400).json({ error: 'All connection fields are required' });
        }

        const result = await testConnection({
            db_type,
            host,
            port: parseInt(port),
            database_name,
            username,
            password // Use raw password for testing new connections
        });

        if (result.success) {
            res.json({ connected: true, message: 'Connection successful' });
        } else {
            res.json({ connected: false, error: result.error });
        }

    } catch (error) {
        console.error('Test new connection error:', error);
        res.status(500).json({ connected: false, error: error.message });
    }
});

/**
 * POST /api/connections/:id/grant/:userId
 * Grant user access to a database (admin only)
 */
router.post('/:id/grant/:userId', requireAdmin, (req, res) => {
    try {
        const connectionId = parseInt(req.params.id);
        const userId = parseInt(req.params.userId);

        accessQueries.grantAccess.run(userId, connectionId);

        res.json({
            success: true,
            message: 'Access granted successfully'
        });

    } catch (error) {
        console.error('Grant access error:', error);
        res.status(500).json({ error: 'Failed to grant access' });
    }
});

/**
 * DELETE /api/connections/:id/grant/:userId
 * Revoke user access to a database (admin only)
 */
router.delete('/:id/grant/:userId', requireAdmin, (req, res) => {
    try {
        const connectionId = parseInt(req.params.id);
        const userId = parseInt(req.params.userId);

        accessQueries.revokeAccess.run(userId, connectionId);

        res.json({
            success: true,
            message: 'Access revoked successfully'
        });

    } catch (error) {
        console.error('Revoke access error:', error);
        res.status(500).json({ error: 'Failed to revoke access' });
    }
});

/**
 * GET /api/connections/:id/users
 * Get users with access to a database (admin only)
 */
router.get('/:id/users', requireAdmin, (req, res) => {
    try {
        const connectionId = parseInt(req.params.id);

        // Custom query to get users with access
        const users = accessQueries.getUserDatabases.all(connectionId);
        res.json(users);

    } catch (error) {
        console.error('Get connection users error:', error);
        res.status(500).json({ error: 'Failed to fetch users for connection' });
    }
});

/**
 * GET /api/connections/user/:userId
 * Get databases assigned to a specific user (admin only)
 */
router.get('/user/:userId', requireAdmin, (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        const connections = accessQueries.getUserDatabases.all(userId);
        res.json(connections);
    } catch (error) {
        console.error('Get user connections error:', error);
        res.status(500).json({ error: 'Failed to get user connections' });
    }
});

export default router;
