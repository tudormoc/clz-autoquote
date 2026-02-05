'use client';

import { useState } from 'react';
import { getClientDetailsAction } from '../app/client-actions';

export function ClientTableInspector() {
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [data, setData] = useState<{ columns: string[], sample: any[] } | null>(null);
    const [error, setError] = useState('');

    const handleInspect = async () => {
        setStatus('loading');
        try {
            const result = await getClientDetailsAction();
            if (result.success) {
                setData({ columns: result.columns || [], sample: result.sample || [] });
                setStatus('success');
            } else {
                setError(result.message || 'Unknown error');
                setStatus('error');
            }
        } catch (err: any) {
            setError(err.message);
            setStatus('error');
        }
    };

    return (
        <div className="mt-8 p-6 bg-white rounded-xl border border-gray-200 shadow-sm">
            <h2 className="text-lg font-medium mb-4">Table Info: <span className="font-mono text-blue-600">anagra</span></h2>

            <button
                onClick={handleInspect}
                disabled={status === 'loading'}
                className="mb-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
                {status === 'loading' ? 'Inspecting...' : 'Inspect Columns & Data'}
            </button>

            {status === 'success' && data && (
                <div className="space-y-4">
                    <div>
                        <p className="font-semibold text-sm mb-2 text-gray-700">All Column Names:</p>
                        <div className="flex flex-wrap gap-2">
                            {data.columns.map(col => (
                                <span key={col} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-[10px] font-mono border border-gray-200">
                                    {col}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div>
                        <p className="font-semibold text-sm mb-2 text-gray-700">Sample Data (Top 5):</p>
                        <div className="overflow-x-auto border border-gray-100 rounded-lg">
                            <table className="min-w-full divide-y divide-gray-200 text-[10px] font-mono">
                                <thead className="bg-gray-50">
                                    <tr>
                                        {data.columns.slice(0, 8).map(col => (
                                            <th key={col} className="px-3 py-2 text-left text-gray-500 uppercase tracking-wider">{col}</th>
                                        ))}
                                        <th className="px-3 py-2 text-left text-gray-500">...</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-100">
                                    {data.sample.map((row, i) => (
                                        <tr key={i}>
                                            {data.columns.slice(0, 8).map(col => (
                                                <td key={col} className="px-3 py-2 whitespace-nowrap text-gray-900">{String(row[col])}</td>
                                            ))}
                                            <td className="px-3 py-2 text-gray-400">...</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p className="mt-2 text-[10px] text-gray-500">* Showing first 8 columns for brevity</p>
                    </div>
                </div>
            )}

            {status === 'error' && (
                <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">
                    {error}
                </div>
            )}
        </div>
    );
}
