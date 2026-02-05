import { Header } from '@/components/Header';
import { AdvancedQuoteForm } from '@/components/quote/AdvancedQuoteForm';

export default function Home() {
    return (
        <div className="min-h-screen bg-[#FDFCFB] text-[#1A1A1A]">
            <Header />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-8">
                    <h1 className="text-2xl font-semibold text-[#414131]">New Quote</h1>
                    <p className="text-[#6B6B5F] mt-1">Enter the book specifications below to generate a real-time detailed quote.</p>
                </div>

                <AdvancedQuoteForm />
            </main>
        </div>
    );
}
