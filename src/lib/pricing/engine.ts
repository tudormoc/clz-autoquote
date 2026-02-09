import { PricingRule, QuoteInput, QuoteBreakdown, CostItem, DiscountTier, SignatureType } from './types';
import {
    calculateCoverProductionType,
    calculateCFGSProductionRate,
    calculateCFGSComplexity,
    findDiscountTier,
    calculateDiscountFactor,
    getDiscountLabel,
    applyDiscountToItem,
    calculateOperationCost
} from './formulas';

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
    const tier = findDiscountTier(input.quantity, discountTiers);
    const discountFactor = calculateDiscountFactor(tier);
    const discountLabel = getDiscountLabel(tier);

    // --- 1. Internal Block (CFGS: Cutting, Folding, Gathering, Sewing) ---
    const cfgsRule = getRule('cfgs');
    if (cfgsRule) {
        const complexity = calculateCFGSComplexity(input);
        const { rate: unitProductionRate, details } = calculateCFGSProductionRate(
            input,
            signatureTypes,
            cfgsRule.production_base_cost
        );

        const cost = calculateOperationCost(cfgsRule, input.quantity, complexity, unitProductionRate);

        // Update details with signature breakdown
        cost.item.details = `Setup (sigs-1): ${cost.setup.toFixed(2)} | Prod (${details}): ${unitProductionRate.toFixed(4)}/unit`;

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

// Re-export for backward compatibility
export { calculateCoverProductionType };

