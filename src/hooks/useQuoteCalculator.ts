import { useState, useEffect } from 'react';
import { PRICING_CONSTANTS } from '@/config/constants';
import { APP_COPY } from '@/locales/en';
import type { Quote } from '@/types/database';
import type { QuoteResult } from '@/lib/pricing-engine';
import { QuoteRequestSchema } from '@/lib/pricing-engine';
import { processQuoteAction, getQuoteHistoryAction } from '@/app/actions';

export const useQuoteCalculator = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [quotesHistory, setQuotesHistory] = useState<Quote[]>([]);

    const [formData, setFormData] = useState<{
        bookName: string;
        email: string;
        quantity: number;
        width: number;
        height: number;
        pages: number;
    }>({
        bookName: PRICING_CONSTANTS.DEFAULTS.BOOK_NAME,
        email: '',
        quantity: PRICING_CONSTANTS.DEFAULTS.QUANTITY,
        width: PRICING_CONSTANTS.DEFAULTS.WIDTH,
        height: PRICING_CONSTANTS.DEFAULTS.HEIGHT,
        pages: PRICING_CONSTANTS.DEFAULTS.PAGES,
    });

    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [currentQuote, setCurrentQuote] = useState<QuoteResult | null>(null);

    const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        try {
            const history = await getQuoteHistoryAction();
            setQuotesHistory(history);
        } catch (err) {
            console.error("Failed to fetch history:", err);
        }
    };

    const handleSelectQuote = (quote: Quote) => {
        setEditingQuoteId(quote.id);
        setFormData({
            bookName: quote.book_name,
            email: quote.customer_email || '',
            quantity: quote.quantity,
            width: Number(quote.width),
            height: Number(quote.height),
            pages: quote.pages,
        });
        setCurrentQuote(null); // Clear previous result to focus on editing form
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;

        setFormData(prev => ({
            ...prev,
            [name]: type === 'number' ? parseFloat(value) : value
        }));

        if (formErrors[name]) {
            setFormErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[name];
                return newErrors;
            });
        }
    };

    const handleCalculate = async () => {
        setCurrentQuote(null);
        setFormErrors({});
        setError(null);

        const validation = QuoteRequestSchema.safeParse(formData);

        if (!validation.success) {
            const errors: Record<string, string> = {};
            validation.error.issues.forEach(err => {
                const fieldName = err.path[0] as string;
                errors[fieldName] = err.message;
            });
            setFormErrors(errors);
            return;
        }

        setLoading(true);
        try {
            // Pass editingQuoteId if we are in edit mode
            const response = await processQuoteAction(validation.data, editingQuoteId || undefined);

            if ('error' in response) {
                setError(response.error ?? APP_COPY.errors.generic);
                return;
            }

            if (response.result) {
                setCurrentQuote(response.result);
                if (response.warning) {
                    console.warn(response.warning);
                }
                fetchHistory();
                // We keep editingQuoteId set so they can keep tweaking this same quote
                // Or successful save could exit edit mode? 
                // Let's decide to EXIT edit mode on successful save to "Confirm" changes?
                // actually, for "Calculate" usually we might want to keep editing until done.
                // But since we SAVE to DB, it might be confusing if we keep "editing" the old ID but we just saved.
                // Actually if we UPDATE, the ID is same.
                // So keeping it is fine.
            }
        } catch (e) {
            console.error(e);
            setError(APP_COPY.errors.generic);
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setCurrentQuote(null);
        setEditingQuoteId(null);
        setFormData({
            bookName: PRICING_CONSTANTS.DEFAULTS.BOOK_NAME,
            email: '',
            quantity: PRICING_CONSTANTS.DEFAULTS.QUANTITY,
            width: PRICING_CONSTANTS.DEFAULTS.WIDTH,
            height: PRICING_CONSTANTS.DEFAULTS.HEIGHT,
            pages: PRICING_CONSTANTS.DEFAULTS.PAGES,
        });
        setFormErrors({});
        setError(null);
    };

    return {
        formData,
        formErrors,
        loading,
        error,
        quotesHistory,
        currentQuote,
        editingQuoteId,
        handleInputChange,
        handleCalculate,
        handleReset,
        handleSelectQuote
    };
};
