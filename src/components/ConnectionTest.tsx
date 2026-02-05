'use client';

import { useState } from 'react';
import { testMSSQLConnection } from '../app/test-connection';

export function ConnectionTest() {
    const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');
    const [version, setVersion] = useState('');
    const [tables, setTables] = useState<string[]>([]);

    const handleTest = async () => {
        setStatus('testing');
        setMessage('Testing connection...');
        setTables([]);

        try {
            const result = await testMSSQLConnection();
            if (result.success) {
                setStatus('success');
                setMessage(result.message);
                setVersion(result.version || '');
                setTables(result.tables || []);
            } else {
                setStatus('error');
                setMessage(`Failed: ${result.message} ${result.code ? `(${result.code})` : ''}`);
            }
        } catch (err: any) {
            setStatus('error');
            setMessage(`Error: ${err.message}`);
        }
    };

    return (
        <div className="mt-8 p-6 bg-white rounded-xl border border-gray-200 shadow-sm">
            <h2 className="text-lg font-medium mb-4">Database Connection Test</h2>

            <div className="flex items-center gap-4 mb-4">
                <button
                    onClick={handleTest}
                    disabled={status === 'testing'}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${status === 'testing'
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                >
                    {status === 'testing' ? 'Testing...' : 'Test MSSQL Connection'}
                </button>

                {status === 'success' && (
                    <span className="text-green-600 font-medium">✅ Connected</span>
                )}
                {status === 'error' && (
                    <span className="text-red-600 font-medium">❌ Failed</span>
                )}
            </div>

            {(message || version) && (
                <div className={`p-4 rounded-lg text-sm ${status === 'error' ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-700'
                    }`}>
                    <p className="font-mono break-all">{message}</p>
                    {version && (
                        <div className="mt-2 pt-2 border-t border-gray-200">
                            <p className="font-semibold mb-1">SQL Server Version:</p>
                            <p className="font-mono text-xs opacity-80">{version}</p>
                        </div>
                    )}
                </div>
            )}

            {tables.length > 0 && (
                <div className="mt-4">
                    <p className="font-semibold text-sm mb-2">Available Tables:</p>
                    <div className="flex flex-wrap gap-2">
                        {tables.map(table => (
                            <span key={table} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs border border-blue-100">
                                {table}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {status === 'error' && (
                <div className="mt-4 text-xs text-gray-500">
                    <p className="font-semibold mb-1">Troubleshooting Tips:</p>
                    <ul className="list-disc pl-4 space-y-1">
                        <li>Verify the IP address in .env.local</li>
                        <li>Ensure port 1433 is open (Firewall)</li>
                        <li>Enable TCP/IP in SQL Server Config Manager</li>
                        <li>Check if SQL Server allows Remote Connections</li>
                    </ul>
                </div>
            )}
        </div>
    );
}
