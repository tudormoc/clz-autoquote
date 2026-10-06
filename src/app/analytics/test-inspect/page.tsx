'use client';

import { useEffect, useState } from 'react';
import { testSpecificQuery } from '../analytics-actions';

export default function TestInspectPage() {
    const [data, setData] = useState<any>(null);

    useEffect(() => {
        testSpecificQuery().then(setData);
    }, []);

    if (!data) return <div className="p-8">Loading...</div>;

    return (
        <div className="p-8 bg-background text-fg">
            <h1 className="text-2xl mb-4">Test Query: DataWarehouse Client Data</h1>
            
            {data.success ? (
                <>
                    <div className="mb-4 text-fg-muted">
                        {data.message}
                    </div>
                    
                    <div>
                        <h2 className="text-xl mb-2 text-success-500">Commessa Test Results:</h2>
                        <pre className="bg-card p-4 rounded overflow-auto text-xs">
                            {JSON.stringify(data.data || data.clientSummary || data, null, 2)}
                        </pre>
                    </div>
                </>
            ) : (
                <div className="text-danger">Error: {data.error}</div>
            )}
        </div>
    );
}
