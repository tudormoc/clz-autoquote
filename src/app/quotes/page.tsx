import { Header } from '@/components/Header';
import { AdvancedQuoteForm } from '@/components/quote/AdvancedQuoteForm';
import { APP_COPY } from '@/locales';
import Link from 'next/link';
import { Settings } from 'lucide-react';

export default function QuotesPage() {
    return (
        <div className="h-screen flex flex-col bg-background overflow-hidden">
            <Header />

            <main className="flex-1 overflow-y-auto">
                <div className="max-w-screen-2xl mx-auto px-4 py-4">
                    <div className="mb-6 flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-semibold text-white">{APP_COPY.quotes.title}</h1>
                            <p className="text-zinc-400 text-sm mt-1">{APP_COPY.quotes.subtitle}</p>
                        </div>
                        <Link
                            href="/quotes/settings"
                            className="flex items-center gap-2 px-4 py-2 bg-card border border-zinc-800 hover:border-primary/50 hover:bg-zinc-800/50 rounded text-zinc-400 hover:text-primary transition-all"
                        >
                            <Settings size={18} />
                            <span className="text-sm font-medium">{APP_COPY.quotes.settings}</span>
                        </Link>
                    </div>

                    <AdvancedQuoteForm />
                </div>
            </main>
        </div>
    );
}
