import React, { useState, useEffect } from 'react';
import {
    Users, Database, Shield, FileText, ChevronRight,
    Plus, Edit2, Trash2, Check, X, RefreshCw, Search,
    UserPlus, AlertCircle
} from 'lucide-react';
import { useAuth, useAuthFetch } from '../contexts/AuthContext';
import { User, UserRole, DbConnection, QueryLog, RolePermission } from '../types';

type AdminTab = 'users' | 'databases' | 'permissions' | 'logs';

const AdminDashboard: React.FC = () => {
    const [activeTab, setActiveTab] = useState<AdminTab>('users');

    const tabs = [
        { id: 'users' as AdminTab, label: 'Users', icon: Users },
        { id: 'databases' as AdminTab, label: 'Databases', icon: Database },
        { id: 'permissions' as AdminTab, label: 'Permissions', icon: Shield },
        { id: 'logs' as AdminTab, label: 'Query Logs', icon: FileText },
    ];

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-7xl mx-auto px-4 py-8">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
                    <p className="text-slate-500 mt-1">Manage users, databases, and permissions</p>
                </div>

                {/* Tab Navigation */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6">
                    <div className="flex border-b border-slate-200">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === tab.id
                                        ? 'text-indigo-600 border-indigo-600'
                                        : 'text-slate-500 border-transparent hover:text-slate-700'
                                        }`}
                                >
                                    <Icon className="w-4 h-4" />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Tab Content */}
                    <div className="p-6">
                        {activeTab === 'users' && <UserManagement />}
                        {activeTab === 'databases' && <DatabaseManagement />}
                        {activeTab === 'permissions' && <PermissionManagement />}
                        {activeTab === 'logs' && <QueryLogViewer />}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ============================================
// USER DATABASE ACCESS MODAL
// ============================================

interface UserDatabaseModalProps {
    user: any;
    onClose: () => void;
}

const UserDatabaseModal: React.FC<UserDatabaseModalProps> = ({ user, onClose }) => {
    const authFetch = useAuthFetch();
    const [connections, setConnections] = useState<DbConnection[]>([]);
    const [userAccess, setUserAccess] = useState<number[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [connsRes, accessRes] = await Promise.all([
                authFetch('/api/connections'),
                authFetch(`/api/connections/user/${user.id}`)
            ]);

            if (connsRes.ok && accessRes.ok) {
                const conns = await connsRes.json();
                const access = await accessRes.json();
                setConnections(conns);
                setUserAccess(access.map((d: any) => d.id));
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const toggleAccess = async (connId: number, hasAccess: boolean) => {
        try {
            if (hasAccess) {
                // Revoke
                await authFetch(`/api/connections/${connId}/grant/${user.id}`, { method: 'DELETE' });
                setUserAccess(prev => prev.filter(id => id !== connId));
            } else {
                // Grant
                await authFetch(`/api/connections/${connId}/grant/${user.id}`, { method: 'POST' });
                setUserAccess(prev => [...prev, connId]);
            }
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-slate-900">
                        Manage Database Access
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <p className="text-sm text-slate-500 mb-4">
                    Assign databases visible to <span className="font-semibold text-slate-700">{user.name}</span>
                </p>

                {loading ? (
                    <div className="text-center py-8 text-slate-500">Loading access...</div>
                ) : (
                    <div className="max-h-[300px] overflow-y-auto space-y-2 border border-slate-100 rounded-lg p-2">
                        {connections.length === 0 ? (
                            <p className="text-center text-sm text-slate-400 py-4">No databases found</p>
                        ) : (
                            connections.map(conn => {
                                const hasAccess = userAccess.includes(conn.id);
                                return (
                                    <div key={conn.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                        <div>
                                            <p className="text-sm font-medium text-slate-700">{conn.name}</p>
                                            <p className="text-xs text-slate-500">{conn.db_type} • {conn.host}</p>
                                        </div>
                                        <button
                                            onClick={() => toggleAccess(conn.id, hasAccess)}
                                            className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${hasAccess
                                                ? 'bg-emerald-100 text-emerald-700 hover:bg-red-100 hover:text-red-700'
                                                : 'bg-slate-200 text-slate-600 hover:bg-emerald-100 hover:text-emerald-700'
                                                }`}
                                        >
                                            {hasAccess ? 'Assigned' : 'Assign'}
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}

                <div className="mt-6 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================
// USER MANAGEMENT COMPONENT
// ============================================

const UserManagement: React.FC = () => {
    const authFetch = useAuthFetch();
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // New state for DB access management
    const [showDbModal, setShowDbModal] = useState(false);
    const [dbUser, setDbUser] = useState<any>(null);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const response = await authFetch('/api/admin/users');
            if (!response.ok) throw new Error('Failed to fetch users');
            const data = await response.json();
            setUsers(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleToggleActive = async (userId: number, currentStatus: number) => {
        try {
            await authFetch(`/api/admin/users/${userId}`, {
                method: 'PUT',
                body: JSON.stringify({ is_active: currentStatus ? 0 : 1 })
            });
            fetchUsers();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const filteredUsers = users.filter(user =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getRoleBadgeColor = (role: string) => {
        switch (role) {
            case 'ADMIN': return 'bg-purple-100 text-purple-700 border-purple-200';
            case 'DEVELOPER': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'ANALYST': return 'bg-green-100 text-green-700 border-green-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    if (loading) {
        return <div className="text-center py-12 text-slate-500">Loading users...</div>;
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search users..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                </div>
                <button
                    onClick={() => { setEditingUser(null); setShowModal(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                    <UserPlus className="w-4 h-4" />
                    Add User
                </button>
            </div>

            {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                </div>
            )}

            <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">User</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Role</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Created</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredUsers.map((user) => (
                            <tr key={user.id} className="hover:bg-slate-50">
                                <td className="px-4 py-3">
                                    <div>
                                        <p className="font-medium text-slate-900">{user.name}</p>
                                        <p className="text-sm text-slate-500">{user.email}</p>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getRoleBadgeColor(user.role)}`}>
                                        {user.role}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <button
                                        onClick={() => handleToggleActive(user.id, user.is_active)}
                                        className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors ${user.is_active
                                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                            }`}
                                    >
                                        {user.is_active ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                                        {user.is_active ? 'Active' : 'Inactive'}
                                    </button>
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-500">
                                    {new Date(user.created_at).toLocaleDateString()}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        {/* Only show DB management for non-admins (Admins have access to all) */}
                                        {user.role !== 'ADMIN' && (
                                            <button
                                                onClick={() => { setDbUser(user); setShowDbModal(true); }}
                                                className="p-1 hover:bg-indigo-50 text-indigo-600 rounded transition-colors"
                                                title="Manage Database Access"
                                            >
                                                <Database className="w-4 h-4" />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => { setEditingUser(user); setShowModal(true); }}
                                            className="p-1 hover:bg-slate-200 rounded transition-colors"
                                            title="Edit User"
                                        >
                                            <Edit2 className="w-4 h-4 text-slate-500" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <UserModal
                    user={editingUser}
                    onClose={() => setShowModal(false)}
                    onSaved={() => { setShowModal(false); fetchUsers(); }}
                />
            )}

            {showDbModal && dbUser && (
                <UserDatabaseModal
                    user={dbUser}
                    onClose={() => setShowDbModal(false)}
                />
            )}
        </div>
    );
};

// ============================================
// USER MODAL COMPONENT
// ============================================

interface UserModalProps {
    user: any;
    onClose: () => void;
    onSaved: () => void;
}

const UserModal: React.FC<UserModalProps> = ({ user, onClose, onSaved }) => {
    const authFetch = useAuthFetch();
    const [formData, setFormData] = useState({
        name: user?.name || '',
        email: user?.email || '',
        password: '',
        role: user?.role || 'ANALYST'
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (user) {
                // Update existing user
                await authFetch(`/api/admin/users/${user.id}`, {
                    method: 'PUT',
                    body: JSON.stringify({ name: formData.name, role: formData.role })
                });
            } else {
                // Create new user
                const response = await authFetch('/api/admin/users', {
                    method: 'POST',
                    body: JSON.stringify(formData)
                });
                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error);
                }
            }
            onSaved();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">
                    {user ? 'Edit User' : 'Add New User'}
                </h2>

                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            required
                        />
                    </div>

                    {!user && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                                <input
                                    type="password"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                    required
                                    minLength={8}
                                />
                            </div>
                        </>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                        <select
                            value={formData.role}
                            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                            <option value="ANALYST">Analyst</option>
                            <option value="DEVELOPER">Developer</option>
                            <option value="ADMIN">Admin</option>
                        </select>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                        >
                            {loading ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ============================================
// DATABASE MANAGEMENT COMPONENT
// ============================================

const DatabaseManagement: React.FC = () => {
    const authFetch = useAuthFetch();
    const { refreshAuth } = useAuth();
    const [connections, setConnections] = useState<DbConnection[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingConn, setEditingConn] = useState<DbConnection | null>(null);
    const [testingId, setTestingId] = useState<number | null>(null);
    const [testResult, setTestResult] = useState<{ id: number; success: boolean; error?: string } | null>(null);

    const fetchConnections = async () => {
        setLoading(true);
        try {
            const response = await authFetch('/api/connections');
            if (response.ok) {
                const data = await response.json();
                setConnections(data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchConnections();
    }, []);

    const handleTest = async (id: number) => {
        setTestingId(id);
        setTestResult(null);
        try {
            const response = await authFetch(`/api/connections/${id}/test`, { method: 'POST' });
            const data = await response.json();
            setTestResult({ id, success: data.connected, error: data.error });
        } catch (err: any) {
            setTestResult({ id, success: false, error: err.message });
        } finally {
            setTestingId(null);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Delete this database connection? Users will lose access.')) return;
        try {
            await authFetch(`/api/connections/${id}`, { method: 'DELETE' });
            await refreshAuth();
            fetchConnections();
        } catch (err) {
            console.error(err);
        }
    };

    const getTypeBadge = (type: string) => {
        const colors: Record<string, string> = {
            'ORACLE': 'bg-red-100 text-red-700',
            'MYSQL': 'bg-blue-100 text-blue-700',
            'POSTGRESQL': 'bg-indigo-100 text-indigo-700'
        };
        return colors[type] || 'bg-slate-100 text-slate-700';
    };

    if (loading) {
        return <div className="text-center py-12 text-slate-500">Loading connections...</div>;
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <p className="text-sm text-slate-500">{connections.length} database connection(s)</p>
                <button
                    onClick={() => { setEditingConn(null); setShowModal(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Add Connection
                </button>
            </div>

            <div className="grid gap-4">
                {connections.map((conn) => (
                    <div key={conn.id} className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-semibold text-slate-900">{conn.name}</h3>
                                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${getTypeBadge(conn.db_type)}`}>
                                        {conn.db_type}
                                    </span>
                                    {conn.is_active ? (
                                        <span className="px-2 py-0.5 text-xs font-medium rounded bg-green-100 text-green-700">Active</span>
                                    ) : (
                                        <span className="px-2 py-0.5 text-xs font-medium rounded bg-slate-100 text-slate-500">Inactive</span>
                                    )}
                                </div>
                                <p className="text-sm text-slate-500">
                                    {conn.host}:{conn.port}/{conn.database_name} • {conn.username}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleTest(conn.id)}
                                    disabled={testingId === conn.id}
                                    className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                                >
                                    {testingId === conn.id ? 'Testing...' : 'Test'}
                                </button>
                                <button
                                    onClick={() => { setEditingConn(conn); setShowModal(true); }}
                                    className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    <Edit2 className="w-4 h-4 text-slate-500" />
                                </button>
                                <button
                                    onClick={() => handleDelete(conn.id)}
                                    className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                </button>
                            </div>
                        </div>
                        {testResult?.id === conn.id && (
                            <div className={`mt-3 p-2 rounded text-sm ${testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                {testResult.success ? '✓ Connection successful' : `✗ ${testResult.error}`}
                            </div>
                        )}
                    </div>
                ))}

                {connections.length === 0 && (
                    <div className="text-center py-12 text-slate-500">
                        <Database className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>No database connections configured</p>
                        <p className="text-sm">Add a connection to get started</p>
                    </div>
                )}
            </div>

            {showModal && (
                <DatabaseModal
                    connection={editingConn}
                    onClose={() => setShowModal(false)}
                    onSaved={() => { setShowModal(false); fetchConnections(); }}
                />
            )}
        </div>
    );
};

// ============================================
// DATABASE MODAL COMPONENT
// ============================================

interface DatabaseModalProps {
    connection: DbConnection | null;
    onClose: () => void;
    onSaved: () => void;
}

const DatabaseModal: React.FC<DatabaseModalProps> = ({ connection, onClose, onSaved }) => {
    const authFetch = useAuthFetch();
    const { refreshAuth } = useAuth();
    const [formData, setFormData] = useState({
        name: connection?.name || '',
        db_type: connection?.db_type || 'ORACLE',
        host: connection?.host || 'localhost',
        port: connection?.port?.toString() || '1521',
        database_name: connection?.database_name || '',
        username: connection?.username || '',
        password: ''
    });
    const [loading, setLoading] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const defaultPorts: Record<string, string> = {
        'ORACLE': '1521',
        'MYSQL': '3306',
        'POSTGRESQL': '5432'
    };

    const handleTypeChange = (type: string) => {
        setFormData({
            ...formData,
            db_type: type,
            port: defaultPorts[type] || '1521'
        });
    };

    const handleTest = async () => {
        setTesting(true);
        setTestResult(null);
        try {
            const response = await authFetch('/api/connections/test-new', {
                method: 'POST',
                body: JSON.stringify(formData)
            });
            const data = await response.json();
            setTestResult({ success: data.connected, error: data.error });
        } catch (err: any) {
            setTestResult({ success: false, error: err.message });
        } finally {
            setTesting(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (connection) {
                await authFetch(`/api/connections/${connection.id}`, {
                    method: 'PUT',
                    body: JSON.stringify(formData)
                });
            } else {
                const response = await authFetch('/api/connections', {
                    method: 'POST',
                    body: JSON.stringify(formData)
                });
                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error);
                }
            }
            await refreshAuth();
            onSaved();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">
                    {connection ? 'Edit Connection' : 'Add Database Connection'}
                </h2>

                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Connection Name</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="My Production Database"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Database Type</label>
                        <select
                            value={formData.db_type}
                            onChange={(e) => handleTypeChange(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                            <option value="ORACLE">Oracle</option>
                            <option value="MYSQL">MySQL</option>
                            <option value="POSTGRESQL">PostgreSQL</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Host</label>
                            <input
                                type="text"
                                value={formData.host}
                                onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Port</label>
                            <input
                                type="number"
                                value={formData.port}
                                onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Database Name</label>
                        <input
                            type="text"
                            value={formData.database_name}
                            onChange={(e) => setFormData({ ...formData, database_name: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                            <input
                                type="text"
                                value={formData.username}
                                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Password {connection && <span className="text-slate-400">(leave blank to keep)</span>}
                            </label>
                            <input
                                type="password"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                required={!connection}
                            />
                        </div>
                    </div>

                    {testResult && (
                        <div className={`p-3 rounded-lg text-sm ${testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                            {testResult.success ? '✓ Connection successful!' : `✗ Connection failed: ${testResult.error}`}
                        </div>
                    )}

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={handleTest}
                            disabled={testing}
                            className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                        >
                            {testing ? 'Testing...' : 'Test Connection'}
                        </button>
                        <div className="flex-1" />
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                        >
                            {loading ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ============================================
// PERMISSION MANAGEMENT COMPONENT
// ============================================

const PermissionManagement: React.FC = () => {
    const authFetch = useAuthFetch();
    const [permissions, setPermissions] = useState<Record<string, RolePermission[]>>({});
    const [loading, setLoading] = useState(true);

    const fetchPermissions = async () => {
        try {
            const response = await authFetch('/api/admin/permissions');
            if (response.ok) {
                const data = await response.json();
                setPermissions(data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPermissions();
    }, []);

    const handleToggle = async (role: string, operation: string, currentValue: boolean, maxRows: number) => {
        try {
            await authFetch('/api/admin/permissions', {
                method: 'PUT',
                body: JSON.stringify({ role, operation, is_allowed: !currentValue, max_rows: maxRows })
            });
            fetchPermissions();
        } catch (err) {
            console.error(err);
        }
    };

    if (loading) {
        return <div className="text-center py-12 text-slate-500">Loading permissions...</div>;
    }

    const operations = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'JOIN', 'CTE'];
    const roles = ['ADMIN', 'DEVELOPER', 'ANALYST'];

    return (
        <div>
            <p className="text-sm text-slate-500 mb-6">Configure which SQL operations each role can perform</p>

            <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Operation</th>
                            {roles.map(role => (
                                <th key={role} className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">{role}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {operations.map(op => (
                            <tr key={op} className="hover:bg-slate-50">
                                <td className="px-4 py-3 font-medium text-slate-700">{op}</td>
                                {roles.map(role => {
                                    const perm = permissions[role]?.find(p => p.operation === op);
                                    const isAllowed = perm?.is_allowed || false;
                                    const isAdmin = role === 'ADMIN';
                                    return (
                                        <td key={role} className="px-4 py-3 text-center">
                                            <button
                                                onClick={() => !isAdmin && handleToggle(role, op, isAllowed, perm?.max_rows || 1000)}
                                                disabled={isAdmin}
                                                className={`w-8 h-8 rounded-full transition-colors ${isAllowed
                                                    ? 'bg-green-500 text-white'
                                                    : 'bg-slate-200 text-slate-400'
                                                    } ${isAdmin ? 'cursor-not-allowed opacity-70' : 'hover:opacity-80'}`}
                                            >
                                                {isAllowed ? <Check className="w-4 h-4 mx-auto" /> : <X className="w-4 h-4 mx-auto" />}
                                            </button>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <p className="text-xs text-slate-400 mt-4">
                Note: Admin permissions cannot be modified. Admins always have full access.
            </p>
        </div>
    );
};

// ============================================
// QUERY LOG VIEWER COMPONENT
// ============================================

const QueryLogViewer: React.FC = () => {
    const authFetch = useAuthFetch();
    const [logs, setLogs] = useState<QueryLog[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const response = await authFetch('/api/admin/logs');
                if (response.ok) {
                    const data = await response.json();
                    setLogs(data);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, []);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'SUCCESS': return 'bg-green-100 text-green-700';
            case 'FAILED': return 'bg-red-100 text-red-700';
            case 'BLOCKED': return 'bg-yellow-100 text-yellow-700';
            default: return 'bg-slate-100 text-slate-700';
        }
    };

    if (loading) {
        return <div className="text-center py-12 text-slate-500">Loading logs...</div>;
    }

    return (
        <div>
            <p className="text-sm text-slate-500 mb-6">Recent query executions across all users</p>

            <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Time</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">User</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Database</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Query</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {logs.map((log) => (
                            <tr key={log.id} className="hover:bg-slate-50">
                                <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">
                                    {new Date(log.created_at).toLocaleString()}
                                </td>
                                <td className="px-4 py-3 text-sm font-medium text-slate-700">
                                    {log.user_name || `User #${log.user_id}`}
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-500">
                                    {log.db_name || `DB #${log.db_connection_id}`}
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusBadge(log.status)}`}>
                                        {log.status}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <code className="text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded block max-w-md truncate">
                                        {log.sql_query}
                                    </code>
                                    {log.error_message && (
                                        <p className="text-xs text-red-500 mt-1">{log.error_message}</p>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {logs.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                                    No query logs yet
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminDashboard;
