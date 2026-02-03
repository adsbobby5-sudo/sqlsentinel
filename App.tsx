
import React, { useState, useMemo, useEffect } from 'react';
import {
  Database,
  ShieldAlert,
  Play,
  FileCode,
  Lock,
  User as UserIcon,
  ChevronRight,
  Settings,
  HelpCircle,
  Table as TableIcon,
  RefreshCw,
  LogOut,
  Shield
} from 'lucide-react';
import { TableSchema, QueryResult, AIResponse, UserRole } from './types';
import { MOCK_DATABASE_SCHEMA, APP_NAME } from './constants';
import { geminiService } from './services/gemini';
import { SQLValidator } from './services/sqlValidator';
import SystemDesignDocs from './components/SystemDesignDocs';
import { AuthProvider, useAuth, useAuthFetch } from './contexts/AuthContext';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import DatabaseSelector from './components/DatabaseSelector';

// Main App wrapper with AuthProvider
const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

// App content that uses auth context
const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading, user, logout, selectedDatabase, permissions } = useAuth();
  const authFetch = useAuthFetch();

  const [view, setView] = useState<'query' | 'design' | 'admin'>('query');
  const [input, setInput] = useState('');
  const [queryLoading, setQueryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiResponse, setAiResponse] = useState<AIResponse | null>(null);
  const [result, setResult] = useState<QueryResult | null>(null);

  // Database schema for selected database
  const [databaseSchema, setDatabaseSchema] = useState<TableSchema[]>([]);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  // Fetch schema when database changes - defined before any early returns
  const fetchSchema = async () => {
    if (!selectedDatabase) {
      setDatabaseSchema(MOCK_DATABASE_SCHEMA);
      return;
    }

    setSchemaLoading(true);
    setSchemaError(null);
    try {
      const response = await authFetch(`/api/query/schema/${selectedDatabase.id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch schema');
      }
      const schema = await response.json();
      setDatabaseSchema(schema);
    } catch (err: any) {
      console.error('Schema fetch error:', err);
      setSchemaError(err.message);
      setDatabaseSchema(MOCK_DATABASE_SCHEMA);
    } finally {
      setSchemaLoading(false);
    }
  };

  // Effect to fetch schema when selected database changes - MUST be before early returns
  useEffect(() => {
    if (isAuthenticated && selectedDatabase) {
      fetchSchema();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDatabase?.id, isAuthenticated]);

  // useMemo MUST be before early returns
  const availableTables = useMemo(() => {
    if (!user) return databaseSchema;
    return databaseSchema.filter(t => !t.restrictedRoles || t.restrictedRoles.includes(user.role as UserRole));
  }, [user?.role, databaseSchema]);

  // Show loading spinner while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login if not authenticated
  if (!isAuthenticated) {
    return <Login />;
  }

  // Show admin view
  if (view === 'admin') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Header
          view={view}
          setView={setView}
          user={user!}
          logout={logout}
          isAdmin={user?.role === UserRole.ADMIN}
        />
        <AdminDashboard />
      </div>
    );
  }

  const handleRunQuery = async () => {
    if (!input.trim()) return;
    if (!selectedDatabase) {
      setError('Please select a database first');
      return;
    }

    setQueryLoading(true);
    setError(null);
    setResult(null);
    setAiResponse(null);

    try {
      // Step 1: Generate SQL via AI
      const response = await geminiService.generateSQL(input, availableTables, user!.role as UserRole);
      setAiResponse(response);

      // If AI couldn't generate SQL (e.g. refused due to policy), stop here
      if (!response.sql || !response.sql.trim()) {
        setQueryLoading(false);
        return;
      }

      // Step 2: Validate generated SQL (client-side pre-check)
      const validation = SQLValidator.validate(response.sql, user!.role as UserRole, databaseSchema);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }

      const finalSql = validation.sanitizedSql!;

      // Step 3: Execute query via backend API with selected database
      const response2 = await authFetch('/api/query/execute', {
        method: 'POST',
        body: JSON.stringify({
          sql: finalSql,
          connectionId: selectedDatabase.id
        })
      });

      if (!response2.ok) {
        const errData = await response2.json();
        throw new Error(errData.error || 'Query execution failed');
      }

      const queryResult = await response2.json();

      setResult({
        columns: queryResult.columns,
        rows: queryResult.rows,
        sql: finalSql,
        executionTimeMs: queryResult.executionTimeMs
      });
      setQueryLoading(false);

    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
      setQueryLoading(false);
    }
  };

  // Show design docs
  if (view === 'design') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Header
          view={view}
          setView={setView}
          user={user!}
          logout={logout}
          isAdmin={user?.role === UserRole.ADMIN}
        />
        <SystemDesignDocs />
      </div>
    );
  }

  // Query Interface (default view)
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Header
        view={view}
        setView={setView}
        user={user!}
        logout={logout}
        isAdmin={user?.role === UserRole.ADMIN}
      />

      <main className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Table Schema Information */}
        <aside className="w-72 bg-white border-r border-slate-200 overflow-y-auto hidden lg:block">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <TableIcon className="w-3 h-3" />
              {selectedDatabase?.db_type || 'Database'} Schema
            </h2>
            <button
              onClick={fetchSchema}
              disabled={schemaLoading}
              className="p-1 hover:bg-slate-200 rounded transition-colors"
              title="Refresh schema"
            >
              <RefreshCw className={`w-3 h-3 text-slate-400 ${schemaLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {schemaLoading ? (
            <div className="p-4 text-center text-slate-400 text-sm">
              Loading schema...
            </div>
          ) : schemaError ? (
            <div className="p-4 text-center text-red-400 text-sm">
              {schemaError}
            </div>
          ) : availableTables.length === 0 ? (
            <div className="p-4 text-center text-slate-400 text-sm">
              No tables found
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {availableTables.map((table) => (
                <div key={table.tableName} className="p-4 hover:bg-slate-50 transition-colors group">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-slate-700 font-mono">{table.tableName}</span>
                    <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-slate-500 transition-colors" />
                  </div>
                  <ul className="space-y-1">
                    {table.columns.map(col => (
                      <li key={col.name} className="flex flex-col">
                        <span className="text-xs font-medium text-slate-600 font-mono">{col.name}</span>
                        <span className="text-[10px] text-slate-400 italic">{col.type}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* Main Workspace */}
        <section className="flex-1 flex flex-col bg-slate-50 overflow-y-auto">
          <div className="max-w-5xl mx-auto w-full p-6 space-y-6">

            {/* Database Selector + Permissions Info */}
            <div className="flex items-center justify-between">
              <DatabaseSelector />
              {permissions && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Shield className="w-3 h-3" />
                  <span>Allowed: {permissions.allowedOperations.join(', ') || 'None'}</span>
                </div>
              )}
            </div>

            {/* Query Input Box */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-indigo-500" />
                  Natural Language Query
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">
                    {selectedDatabase ? `${selectedDatabase.db_type}: ${selectedDatabase.name}` : 'No DB Selected'}
                  </span>
                </div>
              </div>
              <div className="p-5">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="e.g., Show me the total sales amount for the last 30 days grouped by order status..."
                  className="w-full h-32 p-4 text-slate-700 bg-slate-50 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none resize-none placeholder:text-slate-400"
                />
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-xs text-slate-400 italic">
                    Queries are validated for security and RBAC before execution.
                  </p>
                  <button
                    onClick={handleRunQuery}
                    disabled={queryLoading || !input.trim() || !selectedDatabase}
                    className={`flex items-center gap-2 px-6 py-2 rounded-lg font-semibold text-sm transition-all shadow-md ${queryLoading || !input.trim() || !selectedDatabase
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700 active:transform active:scale-95'
                      }`}
                  >
                    {queryLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        Generate & Execute
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-4">
                <ShieldAlert className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-red-800">Security / Validation Error</h4>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            )}

            {/* AI SQL Preview */}
            {aiResponse && !error && (
              <div className="bg-slate-800 rounded-xl shadow-lg overflow-hidden border border-slate-700 animate-in fade-in slide-in-from-bottom-4">
                <div className="px-4 py-2 border-b border-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Generated SQL (Pre-Validation)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-[10px] text-slate-400 font-bold uppercase">AI Trust: High</span>
                  </div>
                </div>
                <div className="p-4 font-mono text-sm">
                  <pre className="text-indigo-300 whitespace-pre-wrap leading-relaxed">
                    {aiResponse.sql}
                  </pre>
                </div>
                <div className="bg-slate-900/50 p-3 flex items-start gap-2 border-t border-slate-700">
                  <span className="text-[10px] font-bold text-indigo-400 uppercase mt-0.5">Explanation:</span>
                  <p className="text-xs text-slate-400 leading-relaxed italic">{aiResponse.explanation}</p>
                </div>
              </div>
            )}

            {/* Execution Result Table */}
            {result && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TableIcon className="w-4 h-4 text-indigo-600" />
                    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Query Result</h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-slate-400 font-medium">{result.rows.length} rows retrieved</span>
                    <span className="text-[10px] text-slate-400 font-medium">{result.executionTimeMs}ms execution time</span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-100">
                        {result.columns.map(col => (
                          <th key={col} className="px-4 py-3 font-semibold text-slate-600 uppercase tracking-wider text-[11px]">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {result.rows.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          {result.columns.map(col => (
                            <td key={`${i}-${col}`} className="px-4 py-3 text-slate-600 font-medium">
                              {typeof row[col] === 'object' ? JSON.stringify(row[col]) : String(row[col])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {!aiResponse && !queryLoading && !error && (
              <div className="py-20 flex flex-col items-center justify-center text-center opacity-40">
                <div className="bg-slate-200 p-4 rounded-full mb-4">
                  <Lock className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-600">Enterprise Guardrails Active</h3>
                <p className="max-w-md text-sm text-slate-500 mt-1">
                  {selectedDatabase
                    ? 'Enter a request above to generate an optimized, secure SQL query using authorized schema tables only.'
                    : 'Select a database to get started.'}
                </p>
              </div>
            )}

          </div>
        </section>
      </main>

      {/* Footer / Status Bar */}
      <footer className="bg-white border-t border-slate-200 px-6 py-2 flex items-center justify-between text-[10px] font-medium text-slate-400">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${selectedDatabase ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            <span>DB: {selectedDatabase ? `${selectedDatabase.db_type} (${selectedDatabase.name})` : 'Not Selected'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            <span>AI ENGINE: GEMINI 3 FLASH</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Settings className="w-3 h-3" />
          <span>SECURITY VERSION 3.0.0 • RBAC ENABLED</span>
        </div>
      </footer>
    </div>
  );
};

// Header Component
interface HeaderProps {
  view: 'query' | 'design' | 'admin';
  setView: (view: 'query' | 'design' | 'admin') => void;
  user: { id: number; name: string; email: string; role: string };
  logout: () => void;
  isAdmin: boolean;
}

const Header: React.FC<HeaderProps> = ({ view, setView, user, logout, isAdmin }) => {
  return (
    <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-2">
        <div className="bg-indigo-600 p-2 rounded-lg">
          <Database className="text-white w-5 h-5" />
        </div>
        <h1 className="text-xl font-bold text-slate-800 tracking-tight">{APP_NAME}</h1>
        <span className="ml-2 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase rounded border border-indigo-200">v3.0</span>
      </div>

      <nav className="flex items-center gap-4">
        <button
          onClick={() => setView('query')}
          className={`px-3 py-1.5 text-sm font-medium transition-colors rounded-md ${view === 'query' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Query Interface
        </button>
        <button
          onClick={() => setView('design')}
          className={`px-3 py-1.5 text-sm font-medium transition-colors rounded-md ${view === 'design' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
        >
          System Design
        </button>
        {isAdmin && (
          <button
            onClick={() => setView('admin')}
            className={`px-3 py-1.5 text-sm font-medium transition-colors rounded-md flex items-center gap-1 ${view === 'admin' ? 'bg-purple-50 text-purple-700' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Shield className="w-3 h-3" />
            Admin
          </button>
        )}
        <div className="h-6 w-px bg-slate-200 mx-2" />
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs font-semibold text-slate-900 leading-none">{user.name}</p>
            <p className="text-[10px] text-slate-500 leading-tight uppercase font-medium">{user.role}</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center border border-slate-300">
            <UserIcon className="w-4 h-4 text-slate-600" />
          </div>
          <button
            onClick={logout}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            title="Logout"
          >
            <LogOut className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </nav>
    </header>
  );
};

export default App;
