import { Header } from '@/components/Header';
import { DBExplorer } from '@/components/DBExplorer';
import { DBStatusSummary } from '@/components/DBStatusSummary';

export const metadata = {
    title: 'Database Explorer | CLZ Autoquote',
    description: 'Internal tool to explore local MSSQL database tables and columns.',
};

export default function DBTestPage() {
    return (
        <div className="min-h-screen bg-background text-foreground">
            <Header />

            <main className="max-w-screen-2xl mx-auto px-4 py-4">
                <div className="mb-6">
                    <h1 className="text-2xl font-semibold text-white">Database Explorer</h1>
                    <p className="text-zinc-400 text-sm mt-1">Explore your local MSSQL database to identify tables for integration.</p>
                </div>

                <DBStatusSummary />

                <DBExplorer />
            </main>
        </div>
    );
}
