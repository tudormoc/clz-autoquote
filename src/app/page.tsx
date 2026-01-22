'use client';
import { AlertCircle } from 'lucide-react';

// Server Actions used in Hook but can be removed here
// Components
import { Header } from '@/components/Header';
import { QuoteForm } from '@/components/QuoteForm';
import { QuoteResultCard } from '@/components/QuoteResultCard';
import { QuoteHistoryList } from '@/components/QuoteHistoryList';
import { useQuoteCalculator } from '@/hooks/useQuoteCalculator';

export default function Home() {
    const {
        formData,
        formErrors,
        loading,
        error,
        quotesHistory,
        currentQuote,
        handleInputChange,
        handleCalculate,
        handleReset
    } = useQuoteCalculator();

    return (
        <div className="min-h-screen bg-[#FDFCFB] text-[#1A1A1A] pb-20">
            <Header />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {error && (
                    <div className="mb-6 bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                        <AlertCircle className="h-5 w-5" />
                        <p>{error}</p>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                    <div className="lg:col-span-7 space-y-8">
                        <QuoteForm
                            formData={formData}
                            formErrors={formErrors}
                            loading={loading}
                            onChange={handleInputChange}
                            onCalculate={handleCalculate}
                            onReset={handleReset}
                        />

                        <QuoteHistoryList history={quotesHistory} />
                    </div>

                    <div className="lg:col-span-5">
                        <QuoteResultCard result={currentQuote} />
                    </div>
                </div>
            </main>
        </div>
    );
}
