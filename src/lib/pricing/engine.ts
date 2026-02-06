import { PricingRule, QuoteInput, QuoteBreakdown, CostItem, DiscountTier, SignatureType } from './types';

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
    discountTiers: DiscountTier[] = [],
    signatureTypes: SignatureType[] = []
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

    // --- 1. Internal Block (CFGS: Cutting, Folding, Gathering, Sewing) ---
    const cfgsRule = getRule('cfgs');
    if (cfgsRule) {
        const customSigs = input.internals.custom_signatures || [];
        const totalSigs = customSigs.reduce((sum, sig) => sum + sig.amount, 0);

        // Calculate Production Rate based on specific signatures
        let unitProductionRate = 0;
        let details = '';

        if (customSigs.length > 0 && signatureTypes.length > 0) {
            // New logic: Sum of (amount * signature_type_unit_price)
            customSigs.forEach(sig => {
                const type = signatureTypes.find(t => t.id === sig.signature_type_id);
                if (type) {
                    unitProductionRate += (sig.amount * type.unit_price);
                    details += `${sig.amount}x${type.name} `;
                }
            });
        } else {
            // Fallback to legacy logic
            unitProductionRate = cfgsRule.production_base_cost;
            details = `Std logic`;
        }

        const complexity = Math.max(0, totalSigs - 1);
        const cost = calculateOperationCost(cfgsRule, input.quantity, complexity, unitProductionRate);

        // Update details with signature breakdown
        cost.item.details = `Setup (sigs-1): ${cost.setup.toFixed(2)} | Prod (${details.trim()}): ${unitProductionRate.toFixed(4)}/unit`;

        applyDiscountToItem(cost, discountFactor, discountLabel);
        items.push(cost.item);
        setupTotal += cost.setup;
        productionTotal += cost.production;
    }

    // --- 2. Cover Production Mode ---
    const prodType = calculateCoverProductionType(input);
    const prodRule = getRule(`cover_${prodType}`);

    if (prodRule) {
        const cost = calculateOperationCost(prodRule, input.quantity, 1);
        applyDiscountToItem(cost, discountFactor, discountLabel);
        cost.item.name = `Cover Production (${prodType})`;
        items.push(cost.item);
        setupTotal += cost.setup;
        productionTotal += cost.production;
    }


    // Final Totals
    const totalBeforeDiscount = setupTotal + productionTotal;

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
function calculateOperationCost(
    rule: PricingRule,
    quantity: number,
    complexityFactor: number,
    overrideUnitRate?: number
) {
    const setupCost = rule.setup_base_cost + (rule.setup_variable_factor * complexityFactor);

    const unitProdRate = overrideUnitRate ?? (rule.production_base_cost + (rule.production_variable_factor * complexityFactor));
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

/**
 * Helper to apply volume discount to a calculated operation item.
 */
function applyDiscountToItem(
    cost: { setup: number; production: number; item: CostItem },
    discountFactor: number,
    label: string | null
) {
    if (discountFactor >= 1) return;

    cost.item.cost = Number((cost.item.cost * discountFactor).toFixed(2));
    if (cost.item.setup_cost) cost.item.setup_cost = Number((cost.item.setup_cost * discountFactor).toFixed(2));
    if (cost.item.production_cost) cost.item.production_cost = Number((cost.item.production_cost * discountFactor).toFixed(2));
    if (cost.item.unit_production_cost) cost.item.unit_production_cost = Number((cost.item.unit_production_cost * discountFactor).toFixed(4));

    if (label) {
        cost.item.details += ` (Applied ${label})`;
    }

    // Adjust the internal numeric totals used for metadata
    cost.setup *= discountFactor;
    cost.production *= discountFactor;
}

