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
        <div className="mt-8 p-4 bg-card rounded-lg border border-zinc-800">
            <h2 className="text-base font-semibold mb-4 text-zinc-100">Table Info: <span className="font-mono text-primary">anagra</span></h2>

            <button
                onClick={handleInspect}
                disabled={status === 'loading'}
                className="mb-4 px-4 h-9 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 transition-colors text-sm font-medium"
            >
                {status === 'loading' ? 'Inspecting...' : 'Inspect Columns & Data'}
            </button>

            {status === 'success' && data && (
                <div className="space-y-4">
                    <div>
                        <p className="text-sm font-semibold mb-2 text-zinc-200">All Column Names:</p>
                        <div className="flex flex-wrap gap-2">
                            {data.columns.map(col => (
                                <span key={col} className="px-2 py-1 bg-zinc-800 text-zinc-300 rounded text-xs font-mono border border-zinc-700">
                                    {col}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div>
                        <p className="text-sm font-semibold mb-2 text-zinc-200">Sample Data (Top 5):</p>
                        <div className="overflow-x-auto border border-zinc-800 rounded-lg">
                            <table className="min-w-full divide-y divide-zinc-800 text-xs font-mono">
                                <thead className="bg-zinc-900">
                                    <tr>
                                        {data.columns.slice(0, 8).map(col => (
                                            <th key={col} className="px-3 py-2 text-left text-zinc-400 text-xs font-medium">{col}</th>
                                        ))}
                                        <th className="px-3 py-2 text-left text-zinc-400 text-xs font-medium">...</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-zinc-950 divide-y divide-zinc-800">
                                    {data.sample.map((row, i) => (
                                        <tr key={i} className="hover:bg-zinc-900/50 transition-colors">
                                            {data.columns.slice(0, 8).map(col => (
                                                <td key={col} className="px-3 py-2 whitespace-nowrap text-zinc-100">{String(row[col])}</td>
                                            ))}
                                            <td className="px-3 py-2 text-zinc-500">...</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p className="mt-2 text-xs text-zinc-500">* Showing first 8 columns for brevity</p>
                    </div>
                </div>
            )}

            {status === 'error' && (
                <div className="p-4 bg-destructive/10 text-destructive rounded-lg text-sm border border-destructive/20">
                    {error}
                </div>
            )}
        </div>
    );
}
