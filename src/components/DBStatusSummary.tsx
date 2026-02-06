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
        <div className="bg-white border border-border p-5 rounded-xl shadow-sm">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-secondary rounded-lg">
                        <Database className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900">{title}</h3>
                        <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">{target}</p>
                    </div>
                </div>
                {loading ? (
                    <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
                ) : result?.success ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                    <XCircle className="h-5 w-5 text-destructive" />
                )}
            </div>

            <div className="text-xs">
                {loading ? (
                    <div className="h-4 bg-gray-100 animate-pulse rounded w-3/4"></div>
                ) : (
                    <p className={result?.success ? 'text-green-700' : 'text-destructive'}>
                        {result?.message || 'Unknown status'}
                    </p>
                )}
            </div>
        </div>
    );

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
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
