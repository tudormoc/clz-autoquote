import { DiscountTier, CostItem } from '../types';

// ============================================================================
// VOLUME DISCOUNT FORMULAS
// ============================================================================
//
// FORMULA OVERVIEW:
// -----------------
// 1. Find Discount Tier
//    → Match quantity to tier range (min_quantity ≤ qty ≤ max_quantity)
//    → Tiers are defined in database (e.g., 0-999: 0%, 1000-4999: 10%, 5000+: 15%)
//
// 2. Calculate Discount Factor
//    → Factor = 1 - discount_percentage
//    → Example: 15% discount → factor = 1 - 0.15 = 0.85
//
// 3. Apply Discount
//    → Discounted Price = Original Price × Factor
//    → Example: €100 × 0.85 = €85
//
// NOTE: Discounts are applied AFTER surcharges in the pricing engine
//
// EDIT DISCOUNT TIERS IN: Admin Dashboard → Discount Tiers Manager
// ============================================================================

/**
 * Finds the applicable discount tier for a given quantity.
 * 
 * Discount tiers are defined in the database with min/max quantity ranges.
 * The function finds the first tier where the quantity falls within range.
 * 
 * @param quantity - Number of units being ordered
 * @param tiers - Available discount tiers from database
 * @returns Matching discount tier or null if no discount applies
 * 
 * @example
 * // Tiers: [0-999: 0%], [1000-4999: 10%], [5000+: 15%]
 * findDiscountTier(500, tiers) → null (no discount)
 * findDiscountTier(2000, tiers) → { discount_percentage: 0.10, ... }
 * findDiscountTier(6000, tiers) → { discount_percentage: 0.15, ... }
 */
export function findDiscountTier(quantity: number, tiers: DiscountTier[]): DiscountTier | null {
    return tiers.find(t =>
        quantity >= t.min_quantity &&
        (t.max_quantity === null || quantity <= t.max_quantity)
    ) || null;
}

/**
 * Calculates the discount factor to multiply prices by.
 * 
 * FORMULA: Factor = 1 - discount_percentage
 * 
 * @param tier - Discount tier (or null if no discount)
 * @returns Discount factor (1.0 = no discount, 0.85 = 15% discount)
 * 
 * @example
 * calculateDiscountFactor(null) → 1.0 (no discount)
 * calculateDiscountFactor({ discount_percentage: 0.10 }) → 0.90 (10% off)
 * calculateDiscountFactor({ discount_percentage: 0.15 }) → 0.85 (15% off)
 */
export function calculateDiscountFactor(tier: DiscountTier | null): number {
    return tier ? (1 - tier.discount_percentage) : 1;
}

/**
 * Applies volume discount to a cost item and its internal tracking values.
 * 
 * This function modifies the cost object in-place, applying the discount
 * to setup and production components separately based on their multipliers.
 * 
 * @param cost - Cost object containing setup, production, and item details
 * @param discountFactor - Base discount factor (e.g., 0.85 for 15% discount)
 * @param label - Human-readable discount label (e.g., "15% volume discount")
 * @param setupMultiplier - Multiplier for setup discount (0.0-1.0, default 1.0)
 * @param productionMultiplier - Multiplier for production discount (0.0-1.0, default 1.0)
 * 
 * @example
 * // Before: { cost: 100, setup_cost: 20, production_cost: 80 }
 * // Apply 15% discount: 100% to setup, 50% to production
 * applyDiscountToItem(cost, 0.85, "15% volume discount", 1.0, 0.5)
 * // After: { cost: 83, setup_cost: 17 (20*0.85), production_cost: 66 (80*0.925) }
 */
export function applyDiscountToItem(
    cost: { setup: number; production: number; item: CostItem },
    discountFactor: number,
    label: string | null,
    setupMultiplier: number = 1.0,
    productionMultiplier: number = 1.0
): void {
    // No discount to apply
    if (discountFactor >= 1) return;

    // Calculate adjusted discount factors for setup and production
    // Formula: adjustedFactor = 1 - ((1 - baseFactor) * multiplier)
    // Example: 15% discount with 0.5 multiplier = 1 - ((1 - 0.85) * 0.5) = 0.925 (7.5% discount)
    const setupDiscountFactor = 1 - ((1 - discountFactor) * setupMultiplier);
    const productionDiscountFactor = 1 - ((1 - discountFactor) * productionMultiplier);

    // Store the base discount percentage in the item (e.g., 0.15 for 15% discount)
    cost.item.discount_percentage = 1 - discountFactor;

    // Store original values before applying discount (only if not already stored by surcharge)
    if (cost.item.setup_cost && !cost.item.original_setup_cost) {
        cost.item.original_setup_cost = cost.item.setup_cost;
    }
    if (cost.item.unit_production_cost && !cost.item.original_unit_production_cost) {
        cost.item.original_unit_production_cost = cost.item.unit_production_cost;
    }

    // Apply discount to setup
    const discountedSetup = cost.setup * setupDiscountFactor;
    if (cost.item.setup_cost) {
        cost.item.setup_cost = Number((cost.item.setup_cost * setupDiscountFactor).toFixed(2));
    }

    // Apply discount to production
    const discountedProduction = cost.production * productionDiscountFactor;
    if (cost.item.production_cost) {
        cost.item.production_cost = Number((cost.item.production_cost * productionDiscountFactor).toFixed(2));
    }
    if (cost.item.unit_production_cost) {
        cost.item.unit_production_cost = Number((cost.item.unit_production_cost * productionDiscountFactor).toFixed(4));
    }

    // Update total cost
    cost.item.cost = Number((discountedSetup + discountedProduction).toFixed(2));

    // Adjust the internal numeric totals used for metadata
    cost.setup = discountedSetup;
    cost.production = discountedProduction;
}

/**
 * Generates a human-readable discount label for display.
 * 
 * @param tier - Discount tier (or null if no discount)
 * @returns Label string (e.g., "15% volume discount") or null
 * 
 * @example
 * getDiscountLabel(null) → null
 * getDiscountLabel({ discount_percentage: 0.10 }) → "10% volume discount"
 * getDiscountLabel({ discount_percentage: 0.15 }) → "15% volume discount"
 */
export function getDiscountLabel(tier: DiscountTier | null): string | null {
    if (!tier || tier.discount_percentage <= 0) return null;
    return `${(tier.discount_percentage * 100).toFixed(0)}% volume discount`;
}
