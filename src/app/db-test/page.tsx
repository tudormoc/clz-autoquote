import { Header } from '@/components/Header';
import { DBExplorer } from '@/components/DBExplorer';

export const metadata = {
    title: 'Database Explorer | CLZ Autoquote',
    description: 'Internal tool to explore local MSSQL database tables and columns.',
};

export default function DBTestPage() {
    return (
        <div className="min-h-screen bg-[#FDFCFB] text-[#1A1A1A]">
            <Header />

            <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-8">
                    <h1 className="text-2xl font-semibold text-[#414131]">Database Explorer</h1>
                    <p className="text-[#6B6B5F] mt-1">Explore your local MSSQL database to identify tables for integration.</p>
                </div>

                <DBExplorer />
            </main>
        </div>
    );
}
