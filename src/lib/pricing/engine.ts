import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../../types/database';
import { PricingRule, QuoteInput, QuoteBreakdown, CostItem, DiscountTier } from './types';

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
 * Fetches volume discount tiers from Supabase.
 */
export async function fetchDiscountTiers(supabase: SupabaseClient<Database>): Promise<DiscountTier[]> {
    const { data, error } = await supabase
        .from('discount_tiers')
        .select('*')
        .order('min_quantity', { ascending: true });

    if (error) {
        console.error('Error fetching discount tiers:', error);
        return [];
    }

    return data.map(tier => ({
        min_quantity: Number(tier.min_quantity),
        max_quantity: tier.max_quantity ? Number(tier.max_quantity) : null,
        discount_percentage: Number(tier.discount_percentage)
    }));
}

/**
 * Automatically determines the cover production type based on book specifications.
 */
export function calculateCoverProductionType(input: QuoteInput): 'standard' | 'fast' | 'manual' {
    const { width, height } = input.format;
    const { headbands_enabled, spine_type } = input.cover_details;
    const { quantity } = input;

    // 1. Manual check (Overrides everything else)
    if (width > 305 || height > 380) {
        return 'manual';
    }

    // 2. Fast check
    const isFastWidth = width > 99 && width < 296;
    const isFastHeight = height > 119 && height < 381;
    const hasNoHeadbands = !headbands_enabled;
    const isBulkOrder = quantity >= 1000;
    const isSquareSpine = spine_type === 'square';

    if (isFastWidth && isFastHeight && hasNoHeadbands && isBulkOrder && isSquareSpine) {
        return 'fast';
    }

    // 3. Default to Standard
    return 'standard';
}

/**
 * Calculates a detailed quote breakdown based on inputs and rules.
 */
export function calculateDetailedQuote(
    input: QuoteInput,
    rules: PricingRule[],
    discountTiers: DiscountTier[] = []
): QuoteBreakdown {
    const items: CostItem[] = [];
    let setupTotal = 0;
    let productionTotal = 0;

    // Helper to find rule by slug
    const getRule = (slug: string) => rules.find(r => r.slug === slug);

    // 0. Resolve the relevant discount percentage for the given quantity
    const tier = discountTiers.find(t =>
        input.quantity >= t.min_quantity &&
        (t.max_quantity === null || input.quantity <= t.max_quantity)
    );
    const discountFactor = tier ? (1 - tier.discount_percentage) : 1;
    const discountLabel = tier && tier.discount_percentage > 0
        ? `${(tier.discount_percentage * 100).toFixed(0)}% volume discount`
        : null;

    // --- 1. Cover Production Mode (System Assigned) ---
    // This is currently our only live pricing operation.
    const prodType = calculateCoverProductionType(input);
    const prodSlug = `cover_${prodType}`;
    const prodRule = getRule(prodSlug);

    if (prodRule) {
        const cost = calculateOperationCost(prodRule, input.quantity, 1);

        // Apply discount to this specific operation
        if (discountFactor < 1) {
            cost.item.cost = Number((cost.item.cost * discountFactor).toFixed(2));
            if (cost.item.setup_cost) cost.item.setup_cost = Number((cost.item.setup_cost * discountFactor).toFixed(2));
            if (cost.item.production_cost) cost.item.production_cost = Number((cost.item.production_cost * discountFactor).toFixed(2));
            if (cost.item.unit_production_cost) cost.item.unit_production_cost = Number((cost.item.unit_production_cost * discountFactor).toFixed(4));

            cost.item.details += ` (Applied ${discountLabel})`;

            // Adjust totals accordingly
            cost.setup *= discountFactor;
            cost.production *= discountFactor;
        }

        // Ensure name reflects the specific production mode
        cost.item.name = `Cover Production (${prodType})`;
        items.push(cost.item);
        setupTotal += cost.setup;
        productionTotal += cost.production;
    } else {
        // Fallback if specific slug doesn't exist: just show as info if no pricing yet
        items.push({
            id: 'cover_production_info',
            name: `Cover Production (${prodType})`,
            type: 'production',
            cost: 0,
            details: 'Price rule pending'
        });
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
            applied_discount: tier?.discount_percentage || 0,
            setup_total: Number(setupTotal.toFixed(2)),
            production_total: Number(productionTotal.toFixed(2)),
            cover_production_type: calculateCoverProductionType(input)
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
            cost: Number((setupCost + totalProdCost).toFixed(2)),
            setup_cost: Number(setupCost.toFixed(2)),
            production_cost: Number(totalProdCost.toFixed(2)),
            unit_production_cost: Number(unitProdRate.toFixed(4)),
            details: `Setup: ${setupCost.toFixed(2)} | Prod: ${unitProdRate.toFixed(4)}/unit`
        }
    };
}
