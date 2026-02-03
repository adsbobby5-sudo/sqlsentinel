
import { FORBIDDEN_SQL_KEYWORDS, MOCK_DATABASE_SCHEMA } from '../constants';
import { UserRole, ValidationResult, TableSchema } from '../types';

export class SQLValidator {
  /**
   * Validates generated SQL against enterprise security rules.
   * @param sql - The SQL query to validate
   * @param role - The user's role for RBAC checks
   * @param schema - Optional schema to validate against (defaults to MOCK_DATABASE_SCHEMA)
   */
  static validate(sql: string, role: UserRole, schema?: TableSchema[]): ValidationResult {
    const upperSql = sql.toUpperCase();
    const activeSchema = schema || MOCK_DATABASE_SCHEMA;

    // 1. Basic Sanitization: Check for forbidden DDL/DML keywords (using word boundaries)
    // ADMINs are allowed to run DDL/DML (server-side RBAC will enforce specific permissions)
    if (role !== UserRole.ADMIN) {
      for (const keyword of FORBIDDEN_SQL_KEYWORDS) {
        // Use word boundary regex to avoid false positives like CREATED_DATE matching CREATE
        const keywordRegex = new RegExp(`\\b${keyword}\\b`, 'i');
        if (keywordRegex.test(sql)) {
          return {
            isValid: false,
            error: `Security Violation: Forbidden keyword '${keyword}' detected.`
          };
        }
      }
    }

    // 2. Multi-statement check (preventing query stacking)
    if (sql.includes(';')) {
      const parts = sql.split(';').filter(p => p.trim().length > 0);
      if (parts.length > 1) {
        return {
          isValid: false,
          error: "Security Violation: Multiple SQL statements detected."
        };
      }
    }

    // 3. Table Access Validation (RBAC) - only if schema is provided
    if (activeSchema.length > 0) {
      const accessibleTables = activeSchema
        .filter(table => !table.restrictedRoles || table.restrictedRoles.includes(role))
        .map(t => t.tableName.toLowerCase());

      const sqlTokens = sql.toLowerCase().match(/\b\w+\b/g) || [];
      const usedTables = sqlTokens.filter(token =>
        activeSchema.some(s => s.tableName.toLowerCase() === token)
      );

      for (const table of usedTables) {
        if (!accessibleTables.includes(table)) {
          return {
            isValid: false,
            error: `Access Denied: You do not have permission to query table '${table}'.`
          };
        }
      }
    }

    // 4. Force Enforce Limits (Oracle uses ROWNUM, not LIMIT)
    let sanitizedSql = sql.trim().replace(/;$/, '');

    // Only apply row limits to SELECT or WITH statements
    const isSelectOrCTE = /^\s*(SELECT|WITH)\b/i.test(sanitizedSql);

    if (isSelectOrCTE && !upperSql.includes('ROWNUM') && !upperSql.includes('FETCH FIRST')) {
      // Wrap query to enforce row limit using Oracle syntax
      sanitizedSql = `SELECT * FROM (${sanitizedSql}) WHERE ROWNUM <= 1000`;
    }

    return {
      isValid: true,
      sanitizedSql
    };
  }
}
