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
        <div className="p-8 bg-background text-foreground">
            <h1 className="text-2xl mb-4">Test Query: QTA Fields in SITUAZIONI</h1>
            
            {data.success ? (
                <>
                    <div className="mb-4 text-zinc-400">
                        {data.message}
                    </div>
                    
                    <div className="mb-8">
                        <h2 className="text-xl mb-2">Available QTA Columns:</h2>
                        <pre className="bg-card p-4 rounded overflow-auto text-xs">
                            {JSON.stringify(data.columns, null, 2)}
                        </pre>
                    </div>

                    <div>
                        <h2 className="text-xl mb-2">Sample Data (10 rows):</h2>
                        <pre className="bg-card p-4 rounded overflow-auto text-xs">
                            {JSON.stringify(data.sample, null, 2)}
                        </pre>
                    </div>
                </>
            ) : (
                <div className="text-destructive">Error: {data.error}</div>
            )}
        </div>
    );
}
