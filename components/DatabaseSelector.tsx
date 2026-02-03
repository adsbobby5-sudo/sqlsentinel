import React from 'react';
import { ChevronDown, Database } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { DbConnection } from '../types';

const DatabaseSelector: React.FC = () => {
    const { allowedDatabases, selectedDatabase, setSelectedDatabase } = useAuth();
    const [isOpen, setIsOpen] = React.useState(false);

    if (allowedDatabases.length === 0) {
        return (
            <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-sm">
                <Database className="w-4 h-4" />
                <span>No databases available</span>
            </div>
        );
    }

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'ORACLE': return 'text-red-500';
            case 'MYSQL': return 'text-blue-500';
            case 'POSTGRESQL': return 'text-indigo-500';
            default: return 'text-slate-500';
        }
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors min-w-[200px]"
            >
                <Database className={`w-4 h-4 ${selectedDatabase ? getTypeColor(selectedDatabase.db_type) : 'text-slate-400'}`} />
                <span className="flex-1 text-left text-sm font-medium text-slate-700 truncate">
                    {selectedDatabase?.name || 'Select Database'}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-10"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute top-full left-0 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1">
                        {allowedDatabases.map((db) => (
                            <button
                                key={db.id}
                                onClick={() => {
                                    setSelectedDatabase(db);
                                    setIsOpen(false);
                                }}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 transition-colors ${selectedDatabase?.id === db.id ? 'bg-indigo-50' : ''
                                    }`}
                            >
                                <Database className={`w-4 h-4 ${getTypeColor(db.db_type)}`} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-700 truncate">{db.name}</p>
                                    <p className="text-xs text-slate-400">{db.db_type} • {db.host}</p>
                                </div>
                                {selectedDatabase?.id === db.id && (
                                    <div className="w-2 h-2 bg-indigo-500 rounded-full" />
                                )}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default DatabaseSelector;
