import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize SQLite database for metadata
// On Vercel, we must use /tmp as it's the only writable directory
const isVercel = process.env.VERCEL || process.env.NODE_ENV === 'production';
const dbPath = isVercel ? '/tmp/sqlsentinel.db' : join(__dirname, 'sqlsentinel.db');

const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize schema first (before preparing statements)
const schemaPath = join(__dirname, 'schema.sql');
const schema = readFileSync(schemaPath, 'utf-8');
db.exec(schema);
console.log('✅ Meta database initialized');

// User operations
export const userQueries = {
  findByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  findById: db.prepare('SELECT id, email, name, role, is_active, created_at FROM users WHERE id = ?'),
  findAll: db.prepare('SELECT id, email, name, role, is_active, created_at FROM users ORDER BY created_at DESC'),
  create: db.prepare('INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)'),
  update: db.prepare('UPDATE users SET name = ?, role = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
  updatePassword: db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
  delete: db.prepare('UPDATE users SET is_active = 0 WHERE id = ?'),
};

// Database connection operations
export const connectionQueries = {
  findAll: db.prepare(`
    SELECT id, name, db_type, host, port, database_name, username, is_active, created_at 
    FROM db_connections 
    ORDER BY name
  `),
  findById: db.prepare('SELECT * FROM db_connections WHERE id = ?'),
  findByName: db.prepare('SELECT * FROM db_connections WHERE name = ?'),
  create: db.prepare(`
    INSERT INTO db_connections (name, db_type, host, port, database_name, username, password_encrypted, created_by) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `),
  update: db.prepare(`
    UPDATE db_connections 
    SET name = ?, db_type = ?, host = ?, port = ?, database_name = ?, username = ?, is_active = ?
    WHERE id = ?
  `),
  updatePassword: db.prepare('UPDATE db_connections SET password_encrypted = ? WHERE id = ?'),
  delete: db.prepare('DELETE FROM db_connections WHERE id = ?'),
};

// User-Database access operations
export const accessQueries = {
  getUserDatabases: db.prepare(`
    SELECT dc.id, dc.name, dc.db_type, dc.host, dc.port, dc.database_name 
    FROM db_connections dc
    JOIN user_db_access uda ON dc.id = uda.db_connection_id
    WHERE uda.user_id = ? AND dc.is_active = 1
  `),
  grantAccess: db.prepare('INSERT OR IGNORE INTO user_db_access (user_id, db_connection_id) VALUES (?, ?)'),
  revokeAccess: db.prepare('DELETE FROM user_db_access WHERE user_id = ? AND db_connection_id = ?'),
  hasAccess: db.prepare('SELECT 1 FROM user_db_access WHERE user_id = ? AND db_connection_id = ?'),
};

// Role permissions operations
export const permissionQueries = {
  getByRole: db.prepare('SELECT operation, is_allowed, max_rows FROM role_permissions WHERE role = ?'),
  isOperationAllowed: db.prepare('SELECT is_allowed, max_rows FROM role_permissions WHERE role = ? AND operation = ?'),
  update: db.prepare('UPDATE role_permissions SET is_allowed = ?, max_rows = ? WHERE role = ? AND operation = ?'),
};

// Query log operations
export const logQueries = {
  create: db.prepare(`
    INSERT INTO query_logs (user_id, db_connection_id, sql_query, status, error_message, execution_time_ms, rows_affected) 
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `),
  findByUser: db.prepare(`
    SELECT ql.*, u.name as user_name, dc.name as db_name 
    FROM query_logs ql
    LEFT JOIN users u ON ql.user_id = u.id
    LEFT JOIN db_connections dc ON ql.db_connection_id = dc.id
    WHERE ql.user_id = ?
    ORDER BY ql.created_at DESC
    LIMIT 100
  `),
  findAll: db.prepare(`
    SELECT ql.*, u.name as user_name, dc.name as db_name 
    FROM query_logs ql
    LEFT JOIN users u ON ql.user_id = u.id
    LEFT JOIN db_connections dc ON ql.db_connection_id = dc.id
    ORDER BY ql.created_at DESC
    LIMIT 500
  `),
};

// Initialize is now a no-op since we init at module load
export function initializeMetaDB() {
  // Already initialized at module load
}

export default db;
