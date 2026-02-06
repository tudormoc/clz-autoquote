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

            <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-8">
                    <h1 className="text-2xl font-semibold text-primary">Database Explorer</h1>
                    <p className="text-muted-foreground mt-1">Explore your local MSSQL database to identify tables for integration.</p>
                </div>

                <DBStatusSummary />

                <DBExplorer />
            </main>
        </div>
    );
}
