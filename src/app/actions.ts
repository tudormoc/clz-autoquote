'use server'

import { calculateDetailedQuote, fetchPricingRules, fetchDiscountTiers } from '@/lib/pricing/engine';
import { QuoteInputSchema } from '@/lib/pricing/validation';
import { supabase } from '@/lib/supabase';
import { dataService } from '@/services/dataService';
import { z } from 'zod';

/**
 * Server Action to calculate a quote and save it using the new Pricing Engine.
 */
export async function processQuoteAction(
    formData: z.infer<typeof QuoteInputSchema>,
    quoteId?: string
) {
    // 1. Validation
    const validation = QuoteInputSchema.safeParse(formData);

    if (!validation.success) {
        return { error: "Validation failed", issues: validation.error.issues };
    }

    // cast validation.data to ensure it matches what engine expects (dates/undefined handling)
    const input = validation.data;

    // 2. Fetch Pricing Rules & Discount Tiers
    // We fetch this fresh on every request to ensure latest prices are used.
    const [rules, tiers] = await Promise.all([
        fetchPricingRules(supabase),
        fetchDiscountTiers(supabase)
    ]);

    // 3. Perform calculation
    const result = calculateDetailedQuote(input, rules, tiers);

    // 4. Save to database
    // Map the complex input back to the flat columns for backward compatibility + JSON blob
    const quotePayload = {
        book_name: input.project_title,
        customer_email: input.email || input.client_name, // Prefer email if valid
        quantity: input.quantity,
        width: input.format.width,
        height: input.format.height,
        pages: input.pages,
        total_price: result.total_price,
        unit_price: result.unit_price,
        applied_discount: result.metadata.applied_discount || 0,
        specifications: input as any // Store full detailed object
    };

    let saveResponse;
    if (quoteId) {
        saveResponse = await dataService.updateQuote(quoteId, quotePayload);
    } else {
        saveResponse = await dataService.saveQuote(quotePayload);
    }

    if (saveResponse.error) {
        console.error("Failed to save quote to database:", saveResponse.error);
        return {
            result,
            warning: "Calculation successful but history could not be updated."
        };
    }

    return { result };
}

/**
 * Server Action to fetch quote history
 */
export async function getQuoteHistoryAction() {
    return await dataService.getQuotes();
}

/**
 * Server Action to delete a quote
 */
export async function deleteQuoteAction(id: string) {
    return await dataService.deleteQuote(id);
}
