import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User, UserPermissions, DbConnection, LoginCredentials, LoginResponse, AuthState } from '../types';

interface AuthContextType extends AuthState {
    login: (credentials: LoginCredentials) => Promise<void>;
    logout: () => void;
    refreshAuth: () => Promise<void>;
    selectedDatabase: DbConnection | null;
    setSelectedDatabase: (db: DbConnection | null) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = 'sql_sentinel_token';
const DEMO_TOKEN = 'demo-admin-token';
const DEMO_USER: User = {
    id: 1,
    email: 'admin@sqlsentinel.local',
    name: 'System Admin',
    role: 'ADMIN'
};
const DEMO_PERMISSIONS: UserPermissions = {
    allowedOperations: ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'JOIN', 'CTE'],
    maxRows: 100000
};

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(DEMO_USER);
    const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY) || DEMO_TOKEN);
    const [permissions, setPermissions] = useState<UserPermissions | null>(DEMO_PERMISSIONS);
    const [allowedDatabases, setAllowedDatabases] = useState<DbConnection[]>([]);
    const [selectedDatabase, setSelectedDatabase] = useState<DbConnection | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const clearAuth = useCallback(() => {
        setUser(null);
        setToken(null);
        setPermissions(null);
        setAllowedDatabases([]);
        setSelectedDatabase(null);
        localStorage.removeItem(TOKEN_KEY);
    }, []);

    const refreshAuth = useCallback(async () => {
        const storedToken = localStorage.getItem(TOKEN_KEY) || DEMO_TOKEN;
        if (!storedToken) {
            setIsLoading(false);
            return;
        }

        if (storedToken === DEMO_TOKEN) {
            setUser(DEMO_USER);
            setToken(DEMO_TOKEN);
            setPermissions(DEMO_PERMISSIONS);
            setAllowedDatabases([]);
            setSelectedDatabase(null);
            setIsLoading(false);
            return;
        }

        try {
            const response = await fetch('/api/auth/me', {
                headers: {
                    'Authorization': `Bearer ${storedToken}`
                }
            });

            if (!response.ok) {
                throw new Error('Token invalid');
            }

            const data = await response.json();
            setUser(data.user);
            setToken(storedToken);
            setPermissions(data.permissions);
            setAllowedDatabases(data.allowedDatabases || []);

            // Auto-select first database if available
            if (data.allowedDatabases?.length > 0 && !selectedDatabase) {
                setSelectedDatabase(data.allowedDatabases[0]);
            }
        } catch (error) {
            console.error('Auth refresh failed:', error);
            clearAuth();
        } finally {
            setIsLoading(false);
        }
    }, [clearAuth, selectedDatabase]);

    useEffect(() => {
        refreshAuth();
    }, []);

    const login = async (credentials: LoginCredentials) => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(credentials)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Login failed');
            }

            const data: LoginResponse = await response.json();

            setToken(data.token);
            setUser(data.user);
            setPermissions(data.permissions);
            setAllowedDatabases(data.allowedDatabases || []);
            localStorage.setItem(TOKEN_KEY, data.token);

            // Auto-select first database
            if (data.allowedDatabases?.length > 0) {
                setSelectedDatabase(data.allowedDatabases[0]);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const logout = async () => {
        if (token) {
            try {
                await fetch('/api/auth/logout', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
            } catch (error) {
                console.error('Logout error:', error);
            }
        }
        clearAuth();
    };

    const value: AuthContextType = {
        user,
        token,
        permissions,
        allowedDatabases,
        isAuthenticated: !!user && !!token,
        isLoading,
        login,
        logout,
        refreshAuth,
        selectedDatabase,
        setSelectedDatabase
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

// Helper hook for making authenticated API calls
export function useAuthFetch() {
    const { token } = useAuth();

    return useCallback(async (url: string, options: RequestInit = {}) => {
        const headers: Record<string, string> = {
            ...(options.headers as Record<string, string> | undefined),
            'Content-Type': 'application/json'
        };

        if (token && token !== DEMO_TOKEN) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(url, {
            ...options,
            headers
        });

        return response;
    }, [token]);
}
