'use server'

import { calculateQuote as engineCalculate, QuoteRequestSchema } from '../lib/pricing-engine';
import { dataService } from '../services/dataService';
import { z } from 'zod';

/**
 * Server Action to calculate a quote and save it to the database.
 * This ensures the logic is private and the database is updated in one trip.
 */
export async function processQuoteAction(formData: z.infer<typeof QuoteRequestSchema>) {
    // 1. Server-side validation
    const validation = QuoteRequestSchema.safeParse(formData);

    if (!validation.success) {
        return { error: "Validation failed", issues: validation.error.issues };
    }

    // 2. Perform calculation strictly on the server
    const result = engineCalculate(validation.data);

    // 3. Save to database
    const { error: saveError } = await dataService.saveQuote({
        book_name: validation.data.bookName,
        customer_email: validation.data.email,
        quantity: validation.data.quantity,
        width: validation.data.width,
        height: validation.data.height,
        pages: validation.data.pages,
        total_price: result.totalPrice,
        unit_price: result.pricePerUnit
    });

    if (saveError) {
        console.error("Failed to save quote to database:", saveError);
        // We still return the calculation result even if saving fails, 
        // but we notify about the error
        return {
            result,
            warning: "Calculation successful but history could not be updated."
        };
    }

    return { result };
}

/**
 * Server Action to fetch history (if we want to move this to server too)
 */
export async function getQuoteHistoryAction() {
    return await dataService.getQuotes();
}
