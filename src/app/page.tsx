import { Header } from '@/components/Header';
import { AdvancedQuoteForm } from '@/components/quote/AdvancedQuoteForm';

export default function Home() {
    return (
        <div className="min-h-screen bg-background text-foreground">
            <Header />

            <main className="max-w-screen-2xl mx-auto px-4 py-4">
                <div className="mb-6">
                    <h1 className="text-2xl font-semibold text-white">New Quote</h1>
                    <p className="text-zinc-400 text-sm mt-1">Enter the book specifications below to generate a real-time detailed quote.</p>
                </div>

                <AdvancedQuoteForm />
            </main>
        </div>
    );
}
