import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { QuoteInputSchema } from '@/lib/pricing/validation';
import { usePricingRules } from './usePricingRules';
import { calculateDetailedQuote, calculateCoverProductionType } from '@/lib/pricing/engine';
import { QuoteBreakdown, QuoteInput } from '@/lib/pricing/types';
import { processQuoteAction, getQuoteHistoryAction, deleteQuoteAction } from '@/app/actions';
import { Quote } from '@/types';
import { APP_CONFIG } from '@/config/constants';

const DEFAULT_VALUES: QuoteInput = {
    project_title: APP_CONFIG.DEFAULTS.BOOK_NAME,
    quantity: APP_CONFIG.DEFAULTS.QUANTITY,
    format: { 
        width: APP_CONFIG.DEFAULTS.WIDTH, 
        height: APP_CONFIG.DEFAULTS.HEIGHT 
    },
    pages: APP_CONFIG.DEFAULTS.PAGES,
    cover_details: {
        type: APP_CONFIG.DEFAULTS.COVER_TYPE,
        spine_type: APP_CONFIG.DEFAULTS.SPINE_TYPE as 'square' | 'round',
        board_thickness: APP_CONFIG.DEFAULTS.BOARD_THICKNESS,
        headbands_enabled: APP_CONFIG.DEFAULTS.HEADBANDS_ENABLED,
        headbands_type: APP_CONFIG.DEFAULTS.HEADBANDS_TYPE as 'politi' | 'g&w',
        finishings: []
    },
    internals: {
        printing_type: 'standard',
        sheet_width: APP_CONFIG.DEFAULTS.SHEET_WIDTH,
        sheet_height: APP_CONFIG.DEFAULTS.SHEET_HEIGHT,
        sheet_thickness: APP_CONFIG.DEFAULTS.SHEET_THICKNESS,
        sheet_weight: APP_CONFIG.DEFAULTS.SHEET_WEIGHT,
        sheet_type: APP_CONFIG.DEFAULTS.SHEET_TYPE as 'coated_matte' | 'coated_gloss',
        endpapers_enabled: APP_CONFIG.DEFAULTS.ENDPAPERS_ENABLED,
        endpapers_weight: APP_CONFIG.DEFAULTS.ENDPAPERS_WEIGHT,
        endpapers_thickness: APP_CONFIG.DEFAULTS.ENDPAPERS_THICKNESS,
        endpapers_type: APP_CONFIG.DEFAULTS.ENDPAPERS_TYPE as 'coated_matte' | 'coated_gloss'
    }
};

export const useAdvancedQuote = () => {
    const { rules, tiers, signatureTypes, rulesLoading } = usePricingRules();
    const [estimate, setEstimate] = useState<QuoteBreakdown | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [history, setHistory] = useState<Quote[]>([]);
    const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);

    useEffect(() => {
        getQuoteHistoryAction().then(setHistory);
    }, []);

    const form = useForm<QuoteInput>({
        resolver: zodResolver(QuoteInputSchema),
        defaultValues: DEFAULT_VALUES,
        mode: 'onChange' // Validate on change for estimate
    });

    const values = form.watch();

    // Auto-calculate cover production type
    useEffect(() => {
        const prodType = calculateCoverProductionType(values as QuoteInput);
        if (prodType !== values.cover_details?.cover_production_type) {
            form.setValue('cover_details.cover_production_type', prodType, { shouldValidate: true });
        }
    }, [
        values.quantity,
        values.format?.width,
        values.format?.height,
        values.cover_details?.headbands_enabled,
        values.cover_details?.spine_type,
        form
    ]);

    // Auto-calculate estimate whenever values or rules change
    useEffect(() => {
        if (rulesLoading) return;

        // Use engine to calculate. 
        // We cast values to QuoteInput because watch() might return partials if defaults aren't fully set,
        // but we provided defaults. Zod parse is safer but engine is loose enough.
        try {
            // Only calculate if we have basic required numbers
            if (values.quantity && values.pages && values.format?.width) {
                const result = calculateDetailedQuote(values as QuoteInput, rules, tiers, signatureTypes);
                setEstimate(result);
            }
        } catch (e) {
            console.warn("Estimation error:", e);
            setEstimate(null);
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(values), rules, tiers, rulesLoading]);

    const onSubmit = async (data: QuoteInput) => {
        setIsSaving(true);
        setSaveError(null);
        try {
            const response = await processQuoteAction(data, selectedQuoteId || undefined);
            if (response.error) {
                setSaveError(response.error);
                console.error(response.issues);
            } else {
                getQuoteHistoryAction().then(setHistory);
                // Clear selected ID after successful save (or keep if we want to follow up with edits)
                // For now, let's keep it if we want to continue editing, or clear if it's a "fresh start"
                // Actually, the user says "what if i want to edit the old quote without creating a new one?"
                // So after "Calculate Quote" (which saves), it updates the record.
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
        setSelectedQuoteId(null);
    };

    const handleDeleteQuote = async (id: string) => {
        try {
            const response = await deleteQuoteAction(id);
            if (response.error) {
                setSaveError("Failed to delete quote");
            } else {
                getQuoteHistoryAction().then(setHistory);
                if (selectedQuoteId === id) {
                    resetToDefault();
                }
            }
        } catch (e) {
            console.error(e);
            setSaveError("Failed to delete quote");
        }
    };

    const selectQuote = (quote: Quote) => {
        setSelectedQuoteId(quote.id);
        if (quote.specifications) {
            const specs = quote.specifications as any;
            form.reset({
                ...specs,
                client_id: quote.customer_id || specs.client_id,
                client_name: quote.customer_name || specs.client_name,
                email: quote.customer_email || specs.email
            });
        } else {
            // Backward compatibility
            form.reset({
                project_title: quote.book_name,
                client_name: quote.customer_name || undefined,
                client_id: quote.customer_id || undefined,
                email: quote.customer_email || undefined,
                quantity: quote.quantity,
                format: { width: Number(quote.width), height: Number(quote.height) },
                pages: quote.pages,
                cover_details: {
                    type: 'hardcover',
                    spine_type: 'square',
                    board_thickness: 2.5,
                    headbands_enabled: false,
                    finishings: []
                },
                internals: {
                    sheet_width: 700,
                    sheet_height: 1000,
                    endpapers_enabled: false
                }
            } as any);
        }
    };

    return {
        form,
        estimate,
        isSaving,
        saveError,
        rulesLoading,
        history,
        signatureTypes,
        selectedQuoteId,
        resetToDefault,
        handleDeleteQuote,
        selectQuote,
        handleSave: form.handleSubmit(onSubmit)
    };
};
