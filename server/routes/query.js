import { Router } from 'express';
import { accessQueries, logQueries } from '../db/meta.js';
import { authMiddleware } from '../middleware/auth.js';
import { validateSqlPermissions, hasDbAccess } from '../middleware/rbac.js';
import { executeQuery, getSchema } from '../utils/connectionPool.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * POST /api/query/execute
 * Execute a SQL query against a selected database
 */
router.post('/execute', async (req, res) => {
    const { connectionId, sql } = req.body;
    const startTime = Date.now();

    if (!connectionId) {
        return res.status(400).json({ error: 'Database connection ID is required' });
    }

    if (!sql || !sql.trim()) {
        return res.status(400).json({ error: 'SQL query is required' });
    }

    // Check database access (admins have access to all)
    if (req.user.role !== 'ADMIN') {
        if (!hasDbAccess(req.user.id, connectionId)) {
            // Log blocked query
            logQueries.create.run(
                req.user.id,
                connectionId,
                sql,
                'BLOCKED',
                'User does not have access to this database',
                0,
                0
            );
            return res.status(403).json({
                error: 'You do not have access to this database'
            });
        }
    }

    // Validate SQL permissions based on role
    const permissionCheck = validateSqlPermissions(sql, req.user.role);
    if (!permissionCheck.valid) {
        // Log blocked query
        logQueries.create.run(
            req.user.id,
            connectionId,
            sql,
            'BLOCKED',
            permissionCheck.error,
            0,
            0
        );
        return res.status(403).json({ error: permissionCheck.error });
    }

    try {
        // Execute query with row limit from permissions
        const result = await executeQuery(connectionId, sql, permissionCheck.maxRows);

        // Log successful query
        logQueries.create.run(
            req.user.id,
            connectionId,
            sql,
            'SUCCESS',
            null,
            result.executionTimeMs,
            result.rowCount
        );

        res.json({
            columns: result.columns,
            rows: result.rows,
            sql,
            executionTimeMs: result.executionTimeMs,
            rowCount: result.rowCount
        });

    } catch (error) {
        console.error('Query execution error:', error);

        // Log failed query
        logQueries.create.run(
            req.user.id,
            connectionId,
            sql,
            'FAILED',
            error.message,
            Date.now() - startTime,
            0
        );

        res.status(500).json({
            error: error.message,
            sql
        });
    }
});

/**
 * GET /api/query/schema/:connectionId
 * Get schema for a database connection
 */
router.get('/schema/:connectionId', async (req, res) => {
    const connectionId = parseInt(req.params.connectionId);

    // Check database access (admins have access to all)
    if (req.user.role !== 'ADMIN') {
        if (!hasDbAccess(req.user.id, connectionId)) {
            return res.status(403).json({
                error: 'You do not have access to this database'
            });
        }
    }

    try {
        const schema = await getSchema(connectionId);
        res.json(schema);
    } catch (error) {
        console.error('Schema fetch error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/query/logs
 * Get query logs for current user (or all for admin)
 */
router.get('/logs', (req, res) => {
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
        res.status(500).json({ error: 'Failed to get query logs' });
    }
});

/**
 * GET /api/query/databases
 * Get databases the current user has access to
 */
router.get('/databases', (req, res) => {
    try {
        const databases = accessQueries.getUserDatabases.all(req.user.id);
        res.json(databases);
    } catch (error) {
        console.error('Get databases error:', error);
        res.status(500).json({ error: 'Failed to get databases' });
    }
});

export default router;
