import { permissionQueries, accessQueries } from '../db/meta.js';

/**
 * Role hierarchy for permission inheritance
 */
const ROLE_HIERARCHY = {
    'ADMIN': 3,
    'DEVELOPER': 2,
    'ANALYST': 1
};

/**
 * Check if user has required role or higher
 * @param {string} userRole - User's role
 * @param {string} requiredRole - Required role
 * @returns {boolean}
 */
export function hasRole(userRole, requiredRole) {
    return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Middleware to require specific role
 * @param {string} requiredRole - Minimum required role
 */
export function requireRole(requiredRole) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!hasRole(req.user.role, requiredRole)) {
            return res.status(403).json({
                error: `Access denied. Required role: ${requiredRole}`,
                yourRole: req.user.role
            });
        }

        next();
    };
}

/**
 * Middleware to require admin role
 */
export const requireAdmin = requireRole('ADMIN');

/**
 * Middleware to require developer role or higher
 */
export const requireDeveloper = requireRole('DEVELOPER');

/**
 * Check if user has permission for SQL operation
 * @param {string} role - User's role
 * @param {string} operation - SQL operation (SELECT, INSERT, UPDATE, DELETE, JOIN, CTE)
 * @returns {{ allowed: boolean, maxRows: number }}
 */
export function checkOperationPermission(role, operation) {
    // Hardcoded security rules for DDL (Admin only)
    if (operation === 'DDL') {
        return { allowed: role === 'ADMIN', maxRows: 0 };
    }

    // Block unknown operations
    if (operation === 'UNKNOWN') {
        return { allowed: false, maxRows: 0 };
    }

    const permission = permissionQueries.isOperationAllowed.get(role, operation.toUpperCase());

    if (!permission) {
        return { allowed: false, maxRows: 0 };
    }

    return {
        allowed: permission.is_allowed === 1,
        maxRows: permission.max_rows
    };
}

/**
 * Get all permissions for a role
 * @param {string} role - User's role
 * @returns {Object} - Permissions object
 */
export function getRolePermissions(role) {
    const permissions = permissionQueries.getByRole.all(role);
    const result = {
        allowedOperations: [],
        maxRows: 1000
    };

    for (const perm of permissions) {
        if (perm.is_allowed) {
            result.allowedOperations.push(perm.operation);
            result.maxRows = Math.max(result.maxRows, perm.max_rows);
        }
    }

    return result;
}

/**
 * Check if user has access to a database connection
 * @param {number} userId - User ID
 * @param {number} connectionId - Database connection ID
 * @returns {boolean}
 */
export function hasDbAccess(userId, connectionId) {
    const access = accessQueries.hasAccess.get(userId, connectionId);
    return !!access;
}

/**
 * Middleware to validate database access
 */
export function requireDbAccess(req, res, next) {
    const connectionId = parseInt(req.body.connectionId || req.params.connectionId);

    if (!connectionId) {
        return res.status(400).json({ error: 'Database connection ID required' });
    }

    // Admins have access to all databases
    if (req.user.role === 'ADMIN') {
        return next();
    }

    if (!hasDbAccess(req.user.id, connectionId)) {
        return res.status(403).json({
            error: 'You do not have access to this database',
            connectionId
        });
    }

    next();
}

/**
 * Validate SQL operation against role permissions
 * @param {string} sql - SQL query
 * @param {string} role - User role
 * @returns {{ valid: boolean, error?: string, maxRows: number }}
 */
export function validateSqlPermissions(sql, role) {
    const upperSql = sql.toUpperCase().trim();
    const permissions = getRolePermissions(role);

    // Detect operation type
    // Detect operation type
    let operation = 'UNKNOWN';
    if (/^\s*SELECT/i.test(upperSql) || /^\s*WITH/i.test(upperSql)) operation = 'SELECT';
    else if (/^\s*(INSERT|INTO)/i.test(upperSql)) operation = 'INSERT';
    else if (/^\s*UPDATE/i.test(upperSql)) operation = 'UPDATE';
    else if (/^\s*DELETE/i.test(upperSql)) operation = 'DELETE';
    else if (/^\s*(CREATE|DROP|ALTER|TRUNCATE|GRANT|REVOKE|RENAME)/i.test(upperSql)) operation = 'DDL';

    // Check if operation is allowed
    const opPermission = checkOperationPermission(role, operation);
    if (!opPermission.allowed) {
        return {
            valid: false,
            error: `You do not have permission to run ${operation} queries`,
            maxRows: 0
        };
    }

    // Check for advanced operations (JOIN, CTE)
    if (/\bJOIN\b/i.test(upperSql)) {
        const joinPermission = checkOperationPermission(role, 'JOIN');
        if (!joinPermission.allowed) {
            return {
                valid: false,
                error: 'You do not have permission to use JOIN operations',
                maxRows: 0
            };
        }
    }

    if (/\bWITH\b.*\bAS\b/i.test(upperSql)) {
        const ctePermission = checkOperationPermission(role, 'CTE');
        if (!ctePermission.allowed) {
            return {
                valid: false,
                error: 'You do not have permission to use Common Table Expressions (CTE)',
                maxRows: 0
            };
        }
    }

    return {
        valid: true,
        maxRows: opPermission.maxRows
    };
}
