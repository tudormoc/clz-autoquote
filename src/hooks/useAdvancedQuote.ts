import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { QuoteInputSchema } from '@/lib/pricing/validation';
import { usePricingRules } from './usePricingRules';
import { calculateDetailedQuote } from '@/lib/pricing/engine';
import { QuoteBreakdown, QuoteInput } from '@/lib/pricing/types';
import { processQuoteAction, getQuoteHistoryAction } from '@/app/actions';
import { Quote } from '@/types/database';

const DEFAULT_VALUES: QuoteInput = {
    project_title: 'My Book Project',
    quantity: 1000,
    format: { width: 148, height: 210 },
    pages: 100,
    cover_details: {
        type: 'hardcover',
        spine_type: 'square',
        board_thickness: 2.5,
        headbands_enabled: false,
        headbands_type: 'politi',
        finishings: []
    },
    internals: {
        printing_type: 'standard',
        sheet_width: 700,
        sheet_height: 1000,
        sheet_weight: 170,
        sheet_type: 'coated_matte',
        endpapers_enabled: false,
        endpapers_weight: 170,
        endpapers_type: 'coated_matte'
    }
};

export const useAdvancedQuote = () => {
    const { rules, rulesLoading } = usePricingRules();
    const [estimate, setEstimate] = useState<QuoteBreakdown | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [history, setHistory] = useState<Quote[]>([]);

    useEffect(() => {
        getQuoteHistoryAction().then(setHistory);
    }, []);

    const form = useForm<QuoteInput>({
        resolver: zodResolver(QuoteInputSchema),
        defaultValues: DEFAULT_VALUES,
        mode: 'onChange' // Validate on change for estimate
    });

    const values = form.watch();

    // Auto-calculate estimate whenever values or rules change
    useEffect(() => {
        if (rulesLoading) return;

        // Use engine to calculate. 
        // We cast values to QuoteInput because watch() might return partials if defaults aren't fully set,
        // but we provided defaults. Zod parse is safer but engine is loose enough.
        try {
            // Only calculate if we have basic required numbers
            if (values.quantity && values.pages && values.format?.width) {
                const result = calculateDetailedQuote(values as QuoteInput, rules);
                setEstimate(result);
            }
        } catch (e) {
            console.warn("Estimation error:", e);
            setEstimate(null);
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(values), rules, rulesLoading]);

    const onSubmit = async (data: QuoteInput) => {
        setIsSaving(true);
        setSaveError(null);
        try {
            const response = await processQuoteAction(data);
            if (response.error) {
                setSaveError(response.error);
                console.error(response.issues);
            } else {
                getQuoteHistoryAction().then(setHistory);
            }
        } catch (e) {
            setSaveError("Failed to save quote");
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    const resetToDefault = () => {
        form.reset(DEFAULT_VALUES);
    };

    return {
        form,
        estimate,
        isSaving,
        saveError,
        rulesLoading,
        history,
        resetToDefault,
        handleSave: form.handleSubmit(onSubmit)
    };
};
