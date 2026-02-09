import { Header } from '@/components/Header';
import { AdvancedQuoteForm } from '@/components/quote/AdvancedQuoteForm';

export default function Home() {
    return (
        <div className="min-h-screen bg-background text-foreground">
            <Header />

            <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="mb-6">
                    <h1 className="text-2xl font-semibold text-primary">New Quote</h1>
                    <p className="text-muted-foreground mt-1">Enter the book specifications below to generate a real-time detailed quote.</p>
                </div>

                <AdvancedQuoteForm />
            </main>
        </div>
    );
}
