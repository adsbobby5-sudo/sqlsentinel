import { connectionQueries } from '../db/meta.js';
import { decrypt } from './encryption.js';

// Cache for connection pools
const pools = new Map();

/**
 * Get database driver for connection type
 * @param {string} dbType - Database type (ORACLE, MYSQL, POSTGRESQL)
 */
async function getDriver(dbType) {
    switch (dbType.toUpperCase()) {
        case 'ORACLE':
            try {
                const oracledb = await import('oracledb');
                return oracledb.default || oracledb;
            } catch (e) {
                console.error('Oracle driver import failed:', e);
                throw new Error('Oracle driver not installed or Instant Client missing.');
            }
        case 'MYSQL':
            // Dynamic import for MySQL if available
            try {
                const mysql = await import('mysql2/promise');
                return mysql;
            } catch (e) {
                throw new Error('MySQL driver not installed. Run: npm install mysql2');
            }
        case 'POSTGRESQL':
            try {
                const pg = await import('pg');
                return pg;
            } catch (e) {
                throw new Error('PostgreSQL driver not installed. Run: npm install pg');
            }
        default:
            throw new Error(`Unsupported database type: ${dbType}`);
    }
}

/**
 * Create a connection pool for a database connection
 * @param {Object} connection - Database connection config from DB
 */
async function createPool(connection) {
    const password = decrypt(connection.password_encrypted);

    switch (connection.db_type.toUpperCase()) {
        case 'ORACLE': {
            const oracledb = await getDriver('ORACLE');
            // Simplified connection check for Vercel/Serverless where thin mode might be needed
            // Try enabling thin mode if not already
            try {
                if (oracledb.initOracleClient) {
                    // Attempt to use thin mode which doesn't require instant client binaries
                    // depending on driver version
                }
            } catch (e) { }

            const pool = await oracledb.createPool({
                user: connection.username,
                password: password,
                connectString: `${connection.host}:${connection.port}/${connection.database_name}`,
                poolMin: 1,
                poolMax: 5,
                poolIncrement: 1,
                poolAlias: `pool_${connection.id}`
            });
            return { type: 'ORACLE', pool };
        }

        case 'MYSQL': {
            const mysql = await getDriver('MYSQL');
            const pool = mysql.createPool({
                host: connection.host,
                port: connection.port,
                database: connection.database_name,
                user: connection.username,
                password: password,
                waitForConnections: true,
                connectionLimit: 5
            });
            return { type: 'MYSQL', pool };
        }

        case 'POSTGRESQL': {
            const { Pool } = await getDriver('POSTGRESQL');
            const pool = new Pool({
                host: connection.host,
                port: connection.port,
                database: connection.database_name,
                user: connection.username,
                password: password,
                max: 5
            });
            return { type: 'POSTGRESQL', pool };
        }

        default:
            throw new Error(`Unsupported database type: ${connection.db_type}`);
    }
}

/**
 * Get a connection from the pool for a given connection ID
 * @param {number} connectionId - Database connection ID
 * @returns {Promise<{connection: any, type: string, release: Function}>}
 */
export async function getConnection(connectionId) {
    // Get connection config from meta DB
    const connConfig = connectionQueries.findById.get(connectionId);

    if (!connConfig) {
        throw new Error(`Database connection not found: ${connectionId}`);
    }

    if (!connConfig.is_active) {
        throw new Error(`Database connection is inactive: ${connConfig.name}`);
    }

    // Check if pool exists, create if not
    if (!pools.has(connectionId)) {
        const poolInfo = await createPool(connConfig);
        pools.set(connectionId, poolInfo);
    }

    const poolInfo = pools.get(connectionId);

    // Get connection from pool based on type
    switch (poolInfo.type) {
        case 'ORACLE': {
            const conn = await poolInfo.pool.getConnection();
            return {
                connection: conn,
                type: 'ORACLE',
                release: async () => await conn.close()
            };
        }

        case 'MYSQL': {
            const conn = await poolInfo.pool.getConnection();
            return {
                connection: conn,
                type: 'MYSQL',
                release: () => conn.release()
            };
        }

        case 'POSTGRESQL': {
            const conn = await poolInfo.pool.connect();
            return {
                connection: conn,
                type: 'POSTGRESQL',
                release: () => conn.release()
            };
        }

        default:
            throw new Error(`Unknown pool type: ${poolInfo.type}`);
    }
}

/**
 * Execute a query on a specific database connection
 * @param {number} connectionId - Database connection ID
 * @param {string} sql - SQL query to execute
 * @param {number} maxRows - Maximum rows to return
 * @returns {Promise<{columns: string[], rows: Object[], executionTimeMs: number}>}
 */
export async function executeQuery(connectionId, sql, maxRows = 1000) {
    const { connection, type, release } = await getConnection(connectionId);
    const startTime = Date.now();

    try {
        let result;

        switch (type) {
            case 'ORACLE': {
                const oracledb = await getDriver('ORACLE');
                result = await connection.execute(sql, [], {
                    outFormat: oracledb.OUT_FORMAT_OBJECT,
                    maxRows
                });
                const columns = result.metaData ? result.metaData.map(col => col.name) : [];
                return {
                    columns,
                    rows: result.rows || [],
                    executionTimeMs: Date.now() - startTime,
                    rowCount: result.rows ? result.rows.length : 0
                };
            }

            case 'MYSQL': {
                const [rows, fields] = await connection.execute(sql);
                const columns = fields ? fields.map(f => f.name) : [];
                const limitedRows = rows.slice(0, maxRows);
                return {
                    columns,
                    rows: limitedRows,
                    executionTimeMs: Date.now() - startTime,
                    rowCount: limitedRows.length
                };
            }

            case 'POSTGRESQL': {
                result = await connection.query(sql);
                const columns = result.fields ? result.fields.map(f => f.name) : [];
                const limitedRows = result.rows.slice(0, maxRows);
                return {
                    columns,
                    rows: limitedRows,
                    executionTimeMs: Date.now() - startTime,
                    rowCount: limitedRows.length
                };
            }

            default:
                throw new Error(`Unknown database type: ${type}`);
        }
    } finally {
        await release();
    }
}

/**
 * Get schema for a database connection
 * @param {number} connectionId - Database connection ID
 * @returns {Promise<Array<{tableName: string, columns: Array}>>}
 */
export async function getSchema(connectionId) {
    const { connection, type, release } = await getConnection(connectionId);

    try {
        switch (type) {
            case 'ORACLE': {
                const oracledb = await getDriver('ORACLE');
                const tablesResult = await connection.execute(
                    `SELECT table_name FROM user_tables ORDER BY table_name`,
                    [],
                    { outFormat: oracledb.OUT_FORMAT_OBJECT }
                );

                const schema = [];
                for (const table of tablesResult.rows || []) {
                    const columnsResult = await connection.execute(
                        `SELECT column_name, data_type FROM user_tab_columns WHERE table_name = :tableName ORDER BY column_id`,
                        { tableName: table.TABLE_NAME },
                        { outFormat: oracledb.OUT_FORMAT_OBJECT }
                    );

                    schema.push({
                        tableName: table.TABLE_NAME,
                        columns: (columnsResult.rows || []).map(col => ({
                            name: col.COLUMN_NAME,
                            type: col.DATA_TYPE,
                            description: ''
                        }))
                    });
                }
                return schema;
            }

            case 'MYSQL': {
                const [tables] = await connection.execute(
                    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME`
                );

                const schema = [];
                for (const table of tables) {
                    const [columns] = await connection.execute(
                        `SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION`,
                        [table.TABLE_NAME]
                    );

                    schema.push({
                        tableName: table.TABLE_NAME,
                        columns: columns.map(col => ({
                            name: col.COLUMN_NAME,
                            type: col.DATA_TYPE,
                            description: ''
                        }))
                    });
                }
                return schema;
            }

            case 'POSTGRESQL': {
                const tablesResult = await connection.query(
                    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
                );

                const schema = [];
                for (const table of tablesResult.rows) {
                    const columnsResult = await connection.query(
                        `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
                        [table.table_name]
                    );

                    schema.push({
                        tableName: table.table_name,
                        columns: columnsResult.rows.map(col => ({
                            name: col.column_name,
                            type: col.data_type,
                            description: ''
                        }))
                    });
                }
                return schema;
            }

            default:
                throw new Error(`Unknown database type: ${type}`);
        }
    } finally {
        await release();
    }
}

/**
 * Test a database connection
 * @param {Object} config - Connection config
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function testConnection(config) {
    try {
        switch (config.db_type.toUpperCase()) {
            case 'ORACLE': {
                const oracledb = await getDriver('ORACLE');
                const password = config.password_encrypted ? decrypt(config.password_encrypted) : config.password;
                const conn = await oracledb.getConnection({
                    user: config.username,
                    password: password,
                    connectString: `${config.host}:${config.port}/${config.database_name}`
                });
                await conn.execute('SELECT 1 FROM DUAL');
                await conn.close();
                return { success: true };
            }

            case 'MYSQL': {
                const mysql = await getDriver('MYSQL');
                const password = config.password_encrypted ? decrypt(config.password_encrypted) : config.password;
                const conn = await mysql.createConnection({
                    host: config.host,
                    port: config.port,
                    database: config.database_name,
                    user: config.username,
                    password: password
                });
                await conn.execute('SELECT 1');
                await conn.end();
                return { success: true };
            }

            case 'POSTGRESQL': {
                const { Client } = await getDriver('POSTGRESQL');
                const password = config.password_encrypted ? decrypt(config.password_encrypted) : config.password;
                const client = new Client({
                    host: config.host,
                    port: config.port,
                    database: config.database_name,
                    user: config.username,
                    password: password
                });
                await client.connect();
                await client.query('SELECT 1');
                await client.end();
                return { success: true };
            }

            default:
                return { success: false, error: `Unsupported database type: ${config.db_type}` };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Close a specific pool
 * @param {number} connectionId - Database connection ID
 */
export async function closePool(connectionId) {
    if (pools.has(connectionId)) {
        const poolInfo = pools.get(connectionId);
        try {
            switch (poolInfo.type) {
                case 'ORACLE':
                    await poolInfo.pool.close(0);
                    break;
                case 'MYSQL':
                    await poolInfo.pool.end();
                    break;
                case 'POSTGRESQL':
                    await poolInfo.pool.end();
                    break;
            }
        } catch (e) {
            console.error(`Error closing pool ${connectionId}:`, e);
        }
        pools.delete(connectionId);
    }
}

/**
 * Close all connection pools
 */
export async function closeAllPools() {
    for (const [id] of pools) {
        await closePool(id);
    }
}
