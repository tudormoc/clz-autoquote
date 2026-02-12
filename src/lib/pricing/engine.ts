import { PricingRule, QuoteInput, QuoteBreakdown, CostItem, DiscountTier, SignatureType } from './types';
import { FormatSurcharge } from '@/types';
import {
    calculateCoverProductionType,
    calculateCFGSProductionRate,
    calculateCFGSComplexity,
    findDiscountTier,
    calculateDiscountFactor,
    getDiscountLabel,
    applyDiscountToItem,
    findMaxFormatSurcharge,
    calculateSurchargeFactor,
    getSurchargeLabel,
    applySurchargeToItem,
    calculateOperationCost,
    calculateGluingSlugs,
    calculateGluingProductionRate
} from './formulas';

/**
 * Calculates a detailed quote breakdown based on inputs and rules.
 */
export function calculateDetailedQuote(
    input: QuoteInput,
    rules: PricingRule[],
    discountTiers: DiscountTier[] = [],
    signatureTypes: SignatureType[] = [],
    formatSurcharges: FormatSurcharge[] = []
): QuoteBreakdown {
    const items: CostItem[] = [];
    let setupTotal = 0;
    let productionTotal = 0;

    // Helper to find rule by slug
    const getRule = (slug: string) => rules.find(r => r.slug === slug);

    // 0. Resolve format surcharge based on dimensions (max of width and height surcharges)
    const surchargePercentage = findMaxFormatSurcharge(input.format.width, input.format.height, formatSurcharges);
    const surchargeFactor = calculateSurchargeFactor(surchargePercentage);
    const surchargeLabel = getSurchargeLabel(surchargePercentage);

    // 1. Resolve the relevant discount percentage for the given quantity
    const tier = findDiscountTier(input.quantity, discountTiers);
    const discountFactor = calculateDiscountFactor(tier);
    const discountLabel = getDiscountLabel(tier);

    // --- 2. Internal Block (CFGS: Cutting, Folding, Gathering, Sewing) ---
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

        // Apply surcharge first (with separate setup/production multipliers)
        applySurchargeToItem(
            cost, 
            surchargeFactor, 
            surchargePercentage,
            cfgsRule.surcharge_multiplier_setup ?? 1.0,
            cfgsRule.surcharge_multiplier_production ?? 1.0
        );
        
        // Then apply discount (with separate setup/production multipliers)
        applyDiscountToItem(
            cost, 
            discountFactor, 
            discountLabel,
            cfgsRule.discount_multiplier_setup ?? 1.0,
            cfgsRule.discount_multiplier_production ?? 1.0
        );
        
        items.push(cost.item);
        setupTotal += cost.setup;
        productionTotal += cost.production;
    }

    // --- 3. Cover Production Mode ---
    const prodType = calculateCoverProductionType(input);
    const prodRule = getRule(`cover_${prodType}`);

    if (prodRule) {
        const cost = calculateOperationCost(prodRule, input.quantity, 1);
        
        // Apply surcharge first (with separate setup/production multipliers)
        applySurchargeToItem(
            cost, 
            surchargeFactor, 
            surchargePercentage,
            prodRule.surcharge_multiplier_setup ?? 1.0,
            prodRule.surcharge_multiplier_production ?? 1.0
        );
        
        // Then apply discount (with separate setup/production multipliers)
        applyDiscountToItem(
            cost, 
            discountFactor, 
            discountLabel,
            prodRule.discount_multiplier_setup ?? 1.0,
            prodRule.discount_multiplier_production ?? 1.0
        );
        
        cost.item.name = `Cover Production (${prodType})`;
        items.push(cost.item);
        setupTotal += cost.setup;
        productionTotal += cost.production;
    }

    // --- 4. Gluing Operations ---
    const gluingSlugs = calculateGluingSlugs(input);
    
    gluingSlugs.forEach(slug => {
        const gluingRule = getRule(slug);
        if (gluingRule) {
            const unitRate = calculateGluingProductionRate(slug, input);
            const cost = calculateOperationCost(gluingRule, input.quantity, 1, unitRate);
            
            // Apply surcharge first (with separate setup/production multipliers)
            applySurchargeToItem(
                cost, 
                surchargeFactor, 
                surchargePercentage,
                gluingRule.surcharge_multiplier_setup ?? 1.0,
                gluingRule.surcharge_multiplier_production ?? 1.0
            );
            
            // Then apply discount (with separate setup/production multipliers)
            applyDiscountToItem(
                cost, 
                discountFactor, 
                discountLabel,
                gluingRule.discount_multiplier_setup ?? 1.0,
                gluingRule.discount_multiplier_production ?? 1.0
            );
            
            items.push(cost.item);
            setupTotal += cost.setup;
            productionTotal += cost.production;
        }
    });


    // Final Totals
    const totalBeforeDiscount = setupTotal + productionTotal;

    return {
        total_price: Number(totalBeforeDiscount.toFixed(2)),
        unit_price: input.quantity > 0 ? Number((totalBeforeDiscount / input.quantity).toFixed(2)) : 0,
        currency: 'EUR',
        items,
        metadata: {
            applied_discount: tier?.discount_percentage || 0,
            applied_surcharge: surchargePercentage,
            setup_total: Number(setupTotal.toFixed(2)),
            production_total: Number(productionTotal.toFixed(2)),
            cover_production_type: calculateCoverProductionType(input)
        }
    };
}

// Re-export for backward compatibility
export { calculateCoverProductionType };

