import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../../types/database';
import { PricingRule, QuoteInput, QuoteBreakdown, CostItem } from './types';

/**
 * Fetches all active pricing rules (Operation + Config) from Supabase.
 */
export async function fetchPricingRules(supabase: SupabaseClient<Database>): Promise<PricingRule[]> {
    const { data, error } = await supabase
        .from('pricing_configs')
        .select(`
        *,
        operation:operations (
            id,
            slug,
            name,
            description,
            category
        )
    `)
        .eq('active', true);

    if (error) {
        console.error('Error fetching pricing rules:', error);
        return [];
    }

    // Transform nested Supabase response to flat PricingRule
    return data.map((config) => {
        // Verify operation is an object (it should be due to M:1 FK)
        const op = Array.isArray(config.operation) ? config.operation[0] : config.operation;

        if (!op) {
            console.warn(`Pricing config ${config.id} has no linked operation`);
            // Return a fallback or filter these out ideally. 
            // For now, casting largely to satisfy TS, but in runtime this needs to be safe.
            return config as any;
        }

        return {
            ...config,
            id: config.id, // Config ID
            slug: op.slug,
            name: op.name, // Operation Name
            description: op.description,
            category: op.category,
            operation_name: op.name,
            // DB fields are number, ensure they are treated as such
            setup_base_cost: Number(config.setup_base_cost),
            setup_variable_factor: Number(config.setup_variable_factor),
            production_base_cost: Number(config.production_base_cost),
            production_variable_factor: Number(config.production_variable_factor),
        } as PricingRule;
    });
}

/**
 * Calculates a detailed quote breakdown based on inputs and rules.
 */
export function calculateDetailedQuote(
    input: QuoteInput,
    rules: PricingRule[]
): QuoteBreakdown {
    const items: CostItem[] = [];
    let setupTotal = 0;
    let productionTotal = 0;

    // Helper to find rule by slug
    const getRule = (slug: string) => rules.find(r => r.slug === slug);

    // --- 1. Core Binding / Cover ---
    // If input.cover_details.type matches an operation slug (e.g., 'hardcover', 'softcover_sewn')
    if (input.cover_details.type) {
        const rule = getRule(input.cover_details.type);
        if (rule) {
            // Complexity: 1 (base binding)
            // Check if we need to account for format size in variable factor?
            // Usually binding cost might depend on spine thickness (pages) or format area.
            // For now, let's assume complexity = 1, but we could use input.pages or area.
            const cost = calculateOperationCost(rule, input.quantity, 1);
            items.push(cost.item);
            setupTotal += cost.setup;
            productionTotal += cost.production;
        }
    }

    // --- 2. Finishings ---
    if (input.cover_details.finishings) {
        for (const finishSlug of input.cover_details.finishings) {
            const rule = getRule(finishSlug);
            if (rule) {
                // Complexity: 1
                const cost = calculateOperationCost(rule, input.quantity, 1);
                items.push(cost.item);
                setupTotal += cost.setup;
                productionTotal += cost.production;
            }
        }
    }

    // --- 3. Internal Operations (Printing/Folding) ---
    // Example: 'folding'
    const foldingRule = getRule('folding');
    if (foldingRule) {
        // Complexity: Number of signatures.
        // Approx: pages / 16 (standard signature size)
        const signatures = Math.ceil(input.pages / 16);
        const cost = calculateOperationCost(foldingRule, input.quantity, signatures);

        // Update item name to reflect signatures
        cost.item.details += ` (x${signatures} sigs)`;

        items.push(cost.item);
        setupTotal += cost.setup;
        productionTotal += cost.production;
    }

    // Example: 'casing_in' if distinct from binding type?
    // Often included in 'hardcover', but if separated:
    const casingRule = getRule('casing_in');
    if (casingRule) {
        const cost = calculateOperationCost(casingRule, input.quantity, 1);
        items.push(cost.item);
        setupTotal += cost.setup;
        productionTotal += cost.production;
    }


    const totalBeforeDiscount = setupTotal + productionTotal;

    // Placeholder for discount logic
    const appliedDiscount = 0; // standard volume discount could be applied here

    // For now, returning total

    return {
        total_price: Number(totalBeforeDiscount.toFixed(2)),
        unit_price: input.quantity > 0 ? Number((totalBeforeDiscount / input.quantity).toFixed(2)) : 0,
        currency: 'EUR',
        items,
        metadata: {
            setup_total: Number(setupTotal.toFixed(2)),
            production_total: Number(productionTotal.toFixed(2))
        }
    };
}

/**
 * Helper to calculate cost for a single operation.
 * Returns Setup Cost and Total Production Cost (Rate * Qty).
 */
function calculateOperationCost(rule: PricingRule, quantity: number, complexityFactor: number) {
    const setupCost = rule.setup_base_cost + (rule.setup_variable_factor * complexityFactor);

    const unitProdRate = rule.production_base_cost + (rule.production_variable_factor * complexityFactor);
    const totalProdCost = unitProdRate * quantity;

    return {
        setup: setupCost,
        production: totalProdCost,
        item: {
            id: rule.slug,
            name: rule.operation_name,
            type: 'production' as const,
            cost: Number((setupCost + totalProdCost).toFixed(2)), // Round for display
            details: `Setup: ${setupCost.toFixed(2)} | Prod: ${unitProdRate.toFixed(4)}/unit`
        }
    };
}
