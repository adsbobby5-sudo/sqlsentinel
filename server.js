import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Initialize environment variables
dotenv.config(); // Load .env
dotenv.config({ path: '.env.local', override: true }); // Load .env.local and override

// Import meta database initialization
import { initializeMetaDB } from './server/db/meta.js';

// Import routes
import authRoutes from './server/routes/auth.js';
import adminRoutes from './server/routes/admin.js';
import connectionRoutes from './server/routes/connections.js';
import queryRoutes from './server/routes/query.js';

// Import middleware
import { authMiddleware, optionalAuthMiddleware } from './server/middleware/auth.js';

// Import connection pool cleanup
import { closeAllPools } from './server/utils/connectionPool.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize meta database
initializeMetaDB();

// ============================================
// PUBLIC ROUTES (no authentication required)
// ============================================

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: '2.0.0',
    features: ['rbac', 'multi-db', 'audit-logs']
  });
});

// Authentication routes (login doesn't require auth)
app.use('/api/auth', authRoutes);

// ============================================
// PROTECTED ROUTES (authentication required)
// ============================================

// Admin routes (user management, permissions, logs)
app.use('/api/admin', adminRoutes);

// Database connection management
app.use('/api/connections', connectionRoutes);

// Query execution with RBAC
app.use('/api/query', queryRoutes);

// ============================================
// LEGACY ENDPOINTS (for backward compatibility)
// ============================================

// Legacy schema endpoint - redirects to query route
app.get('/api/schema', authMiddleware, async (req, res) => {
  // If a connectionId is provided in query params, use it
  const connectionId = req.query.connectionId;

  if (!connectionId) {
    return res.status(400).json({
      error: 'Please select a database. Use GET /api/query/schema/:connectionId'
    });
  }

  // Redirect to new endpoint
  res.redirect(307, `/api/query/schema/${connectionId}`);
});

// Legacy execute-query endpoint - redirects to query route
app.post('/api/execute-query', authMiddleware, async (req, res) => {
  const { sql, connectionId } = req.body;

  if (!connectionId) {
    return res.status(400).json({
      error: 'Please select a database. Include connectionId in request body.'
    });
  }

  // Forward to new query execution route
  // We'll just rewrite the request internally
  req.url = '/api/query/execute';
  queryRoutes(req, res);
});

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  try {
    await closeAllPools();
    console.log('   Connection pools closed');
  } catch (err) {
    console.error('   Error closing pools:', err.message);
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down (SIGTERM)...');
  try {
    await closeAllPools();
    console.log('   Connection pools closed');
  } catch (err) {
    console.error('   Error closing pools:', err.message);
  }
  process.exit(0);
});

// ============================================
// START SERVER
// ============================================

// Export app for Vercel
export default app;

// Only start the server if running directly (not imported as a module)
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n🚀 SQL Sentinel Backend v2.0.0`);
    console.log(`   Server running at http://localhost:${PORT}`);
    console.log(`\n📡 API Endpoints:`);
    console.log(`   Authentication:`);
    console.log(`   - POST /api/auth/login`);
    console.log(`   - GET  /api/auth/me`);
    console.log(`   - POST /api/auth/logout`);
    console.log(`\n   Admin (requires ADMIN role):`);
    console.log(`   - GET/POST       /api/admin/users`);
    console.log(`   - PUT/DELETE     /api/admin/users/:id`);
    console.log(`   - GET/PUT        /api/admin/permissions`);
    console.log(`   - GET            /api/admin/logs`);
    console.log(`\n   Connections:`);
    console.log(`   - GET/POST       /api/connections`);
    console.log(`   - PUT/DELETE     /api/connections/:id`);
    console.log(`   - POST           /api/connections/:id/test`);
    console.log(`\n   Query Execution:`);
    console.log(`   - POST           /api/query/execute`);
    console.log(`   - GET            /api/query/schema/:connectionId`);
    console.log(`   - GET            /api/query/databases`);
    console.log(`\n🔐 Security: RBAC enabled with JWT authentication`);
    console.log(`📊 Audit: All queries logged with user attribution\n`);
  });
}

