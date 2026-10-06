'use client';

import { useState, useEffect } from 'react';
import { testDatabaseConnections } from '@/app/db-test-actions';
import { Database, CheckCircle, XCircle, Loader2 } from 'lucide-react';

export function DBStatusSummary() {
    const [results, setResults] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const runTest = async () => {
            const res = await testDatabaseConnections();
            setResults(res);
            setLoading(false);
        };
        runTest();
    }, []);

    const StatusCard = ({ name, title, target, result }: { name: string, title: string, target: string, result: any }) => (
        <div className="bg-card border border-border p-4 rounded-lg">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-muted rounded">
                        <Database className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-sm text-fg">{title}</h3>
                        <p className="text-3xs text-fg-subtle font-mono uppercase tracking-wider">{target}</p>
                    </div>
                </div>
                {loading ? (
                    <Loader2 className="h-5 w-5 text-fg-subtle animate-spin" />
                ) : result?.success ? (
                    <CheckCircle className="h-5 w-5 text-success-500" />
                ) : (
                    <XCircle className="h-5 w-5 text-danger" />
                )}
            </div>

            <div className="text-xs">
                {loading ? (
                    <div className="h-4 bg-muted animate-pulse rounded w-3/4"></div>
                ) : (
                    <p className={result?.success ? 'text-success-500' : 'text-danger'}>
                        {result?.message || 'Unknown status'}
                    </p>
                )}
            </div>
        </div>
    );

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <StatusCard
                name="business"
                title="Business ERP"
                target="COOPZANARDI"
                result={results?.business}
            />
            <StatusCard
                name="netpro"
                title="NetPro Production"
                target="NETPRO"
                result={results?.netpro}
            />
            <StatusCard
                name="quotes"
                title="Quotes & Engine"
                target="CLZDWHQANDPROG"
                result={results?.quotes}
            />
        </div>
    );
}
