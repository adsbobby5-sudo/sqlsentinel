-- SQL Sentinel Meta Database Schema
-- SQLite database for users, connections, permissions, and logs

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT CHECK(role IN ('ADMIN','DEVELOPER','ANALYST')) NOT NULL DEFAULT 'ANALYST',
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Database connections (encrypted passwords)
CREATE TABLE IF NOT EXISTS db_connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    db_type TEXT CHECK(db_type IN ('ORACLE','MYSQL','POSTGRESQL')) NOT NULL,
    host TEXT NOT NULL,
    port INTEGER NOT NULL,
    database_name TEXT NOT NULL,
    username TEXT NOT NULL,
    password_encrypted TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User-Database access permissions
CREATE TABLE IF NOT EXISTS user_db_access (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    db_connection_id INTEGER REFERENCES db_connections(id) ON DELETE CASCADE,
    UNIQUE(user_id, db_connection_id)
);

-- Role permissions configuration
CREATE TABLE IF NOT EXISTS role_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL,
    operation TEXT CHECK(operation IN ('SELECT','INSERT','UPDATE','DELETE','JOIN','CTE')) NOT NULL,
    is_allowed INTEGER DEFAULT 0,
    max_rows INTEGER DEFAULT 1000,
    UNIQUE(role, operation)
);

-- Query execution logs
CREATE TABLE IF NOT EXISTS query_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    db_connection_id INTEGER REFERENCES db_connections(id),
    sql_query TEXT NOT NULL,
    status TEXT CHECK(status IN ('SUCCESS','FAILED','BLOCKED')) NOT NULL,
    error_message TEXT,
    execution_time_ms INTEGER,
    rows_affected INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Default role permissions
INSERT OR IGNORE INTO role_permissions (role, operation, is_allowed, max_rows) VALUES
    ('ADMIN', 'SELECT', 1, 100000),
    ('ADMIN', 'INSERT', 1, 100000),
    ('ADMIN', 'UPDATE', 1, 100000),
    ('ADMIN', 'DELETE', 1, 100000),
    ('ADMIN', 'JOIN', 1, 100000),
    ('ADMIN', 'CTE', 1, 100000),
    ('DEVELOPER', 'SELECT', 1, 10000),
    ('DEVELOPER', 'INSERT', 0, 0),
    ('DEVELOPER', 'UPDATE', 0, 0),
    ('DEVELOPER', 'DELETE', 0, 0),
    ('DEVELOPER', 'JOIN', 1, 10000),
    ('DEVELOPER', 'CTE', 1, 10000),
    ('ANALYST', 'SELECT', 1, 1000),
    ('ANALYST', 'INSERT', 0, 0),
    ('ANALYST', 'UPDATE', 0, 0),
    ('ANALYST', 'DELETE', 0, 0),
    ('ANALYST', 'JOIN', 0, 0),
    ('ANALYST', 'CTE', 0, 0);

-- Default admin user (password: admin123 - CHANGE IN PRODUCTION)
-- Password hash for 'admin123' using bcrypt
INSERT OR IGNORE INTO users (email, password_hash, name, role, is_active) VALUES
    ('admin@sqlsentinel.local', '$2b$12$z3IkUnTRvTJfL7nFuUUOmX9EaR2XjvP8KbU.hZwcKL', 'System Admin', 'ADMIN', 1);
