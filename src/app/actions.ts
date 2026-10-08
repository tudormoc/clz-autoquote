'use server'

import { calculateDetailedQuote } from '@/lib/pricing/engine';
import { QuoteInputSchema } from '@/lib/pricing/validation';
import { getPricingRules, getDiscountTiers, getSignatureTypes, getFormatSurcharges } from '@/lib/pricing/data';
import { createPricingRule, deletePricingRule } from '@/lib/pricing/ruleWrites';
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

    // 2. Fetch Pricing Rules, Discount Tiers, Signature Types & Format Surcharges from Local MSSQL
    const [rules, tiers, sigs, surcharges] = await Promise.all([
        getPricingRules(),
        getDiscountTiers(),
        getSignatureTypes(),
        getFormatSurcharges()
    ]);

    // 3. Perform calculation
    const result = calculateDetailedQuote(input, rules, tiers, sigs, surcharges);

    // 4. Save to database
    // Map the complex input back to the flat columns for backward compatibility + JSON blob
    const quotePayload = {
        book_name: input.project_title,
        customer_email: input.email || null,
        customer_id: input.client_id || null,
        customer_name: input.client_name || null,
        status: 'draft',
        quantity: input.quantity,
        width: input.format.width,
        height: input.format.height,
        pages: input.pages,
        total_price: result.total_price,
        unit_price: result.unit_price,
        applied_discount: result.metadata.applied_discount || 0,
        specifications: input
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

/**
 * Server Action to fetch latest pricing rules
 */
export async function getPricingRulesAction() {
    return await getPricingRules();
}

/**
 * Server Action to delete a price rule with its operation (rules the quote calculation needs are refused)
 */
export async function deletePricingRuleAction(id: string) {
    return await deletePricingRule(id);
}

/**
 * Server Action to create a price rule (operation + prices in one transaction)
 */
export async function createPricingRuleAction(values: Record<string, unknown>) {
    return await createPricingRule(values);
}

/**
 * Server Action to fetch volume discount tiers
 */
export async function getDiscountTiersAction() {
    return await getDiscountTiers();
}

/**
 * Server Action to fetch signature types
 */
export async function getSignatureTypesAction() {
    return await getSignatureTypes();
}

/**
 * Server Action to fetch format surcharges
 */
export async function getFormatSurchargesAction() {
    return await getFormatSurcharges();
}
