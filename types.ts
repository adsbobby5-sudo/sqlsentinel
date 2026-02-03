
export enum UserRole {
  ANALYST = 'ANALYST',
  DEVELOPER = 'DEVELOPER',
  ADMIN = 'ADMIN'
}

export interface User {
  id: number;
  name: string;
  role: UserRole;
  email: string;
}

export interface Column {
  name: string;
  type: string;
  description: string;
}

export interface TableSchema {
  tableName: string;
  columns: Column[];
  restrictedRoles?: UserRole[];
}

export interface QueryResult {
  columns: string[];
  rows: Record<string, any>[];
  sql: string;
  executionTimeMs: number;
  rowCount?: number;
}

export interface AIResponse {
  sql: string;
  explanation: string;
  tablesUsed: string[];
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedSql?: string;
}

// New types for RBAC and Multi-DB
export interface DbConnection {
  id: number;
  name: string;
  db_type: 'ORACLE' | 'MYSQL' | 'POSTGRESQL';
  host: string;
  port: number;
  database_name: string;
  username: string;
  is_active: boolean;
  created_at?: string;
}

export interface RolePermission {
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'JOIN' | 'CTE';
  is_allowed: boolean;
  max_rows: number;
}

export interface UserPermissions {
  allowedOperations: string[];
  maxRows: number;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  permissions: UserPermissions | null;
  allowedDatabases: DbConnection[];
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface QueryLog {
  id: number;
  user_id: number;
  user_name: string;
  db_connection_id: number;
  db_name: string;
  sql_query: string;
  status: 'SUCCESS' | 'FAILED' | 'BLOCKED';
  error_message?: string;
  execution_time_ms: number;
  rows_affected: number;
  created_at: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
  permissions: UserPermissions;
  allowedDatabases: DbConnection[];
}
