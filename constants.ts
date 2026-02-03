
import { TableSchema, UserRole } from './types';

export const APP_NAME = "SQL Sentinel";

export const MOCK_DATABASE_SCHEMA: TableSchema[] = [
  {
    tableName: 'sales_orders',
    columns: [
      { name: 'order_id', type: 'INT', description: 'Primary key for orders' },
      { name: 'customer_id', type: 'INT', description: 'Link to customer' },
      { name: 'order_date', type: 'DATE', description: 'Date order was placed' },
      { name: 'total_amount', type: 'DECIMAL(10,2)', description: 'Total currency amount' },
      { name: 'status', type: 'VARCHAR', description: 'Order status (Pending, Shipped, Cancelled)' }
    ]
  },
  {
    tableName: 'inventory',
    columns: [
      { name: 'product_id', type: 'INT', description: 'Unique product ID' },
      { name: 'product_name', type: 'VARCHAR', description: 'Human readable name' },
      { name: 'stock_level', type: 'INT', description: 'Quantity currently in warehouse' },
      { name: 'unit_price', type: 'DECIMAL(10,2)', description: 'Cost per single item' }
    ]
  },
  {
    tableName: 'financial_reports',
    restrictedRoles: [UserRole.DEVELOPER, UserRole.ADMIN],
    columns: [
      { name: 'report_id', type: 'INT', description: 'Report ID' },
      { name: 'period', type: 'VARCHAR', description: 'Fiscal period Q1, Q2, etc.' },
      { name: 'net_profit', type: 'DECIMAL(15,2)', description: 'Bottom line profit' },
      { name: 'tax_liability', type: 'DECIMAL(15,2)', description: 'Estimated taxes' }
    ]
  },
  {
    tableName: 'system_logs',
    restrictedRoles: [UserRole.ADMIN],
    columns: [
      { name: 'log_id', type: 'INT', description: 'ID' },
      { name: 'event_type', type: 'VARCHAR', description: 'Security, Error, Info' },
      { name: 'timestamp', type: 'DATETIME', description: 'Event time' },
      { name: 'user_id', type: 'INT', description: 'Actor ID' }
    ]
  }
];

export const FORBIDDEN_SQL_KEYWORDS = [
  'DROP', 'TRUNCATE', 'ALTER', 'DELETE', 'UPDATE', 'INSERT', 'REPLACE',
  'GRANT', 'REVOKE', 'CREATE', 'RENAME', 'EXEC', 'EXECUTE', 'DATABASE', 'SCHEMA'
];
