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
 * to all cost components (setup, production, unit costs).
 * 
 * @param cost - Cost object containing setup, production, and item details
 * @param discountFactor - Discount factor (e.g., 0.85 for 15% discount)
 * @param label - Human-readable discount label (e.g., "15% volume discount")
 * 
 * @example
 * // Before: { cost: 100, setup_cost: 20, production_cost: 80 }
 * applyDiscountToItem(cost, 0.85, "15% volume discount")
 * // After: { cost: 85, setup_cost: 17, production_cost: 68, discount_percentage: 0.15 }
 */
export function applyDiscountToItem(
    cost: { setup: number; production: number; item: CostItem },
    discountFactor: number,
    label: string | null
): void {
    // No discount to apply
    if (discountFactor >= 1) return;

    // Store the discount percentage in the item (e.g., 0.15 for 15% discount)
    cost.item.discount_percentage = 1 - discountFactor;

    // Store original values before applying discount (only if not already stored by surcharge)
    if (cost.item.setup_cost && !cost.item.original_setup_cost) {
        cost.item.original_setup_cost = cost.item.setup_cost;
    }
    if (cost.item.unit_production_cost && !cost.item.original_unit_production_cost) {
        cost.item.original_unit_production_cost = cost.item.unit_production_cost;
    }

    // Apply discount to displayed values
    cost.item.cost = Number((cost.item.cost * discountFactor).toFixed(2));
    if (cost.item.setup_cost) {
        cost.item.setup_cost = Number((cost.item.setup_cost * discountFactor).toFixed(2));
    }
    if (cost.item.production_cost) {
        cost.item.production_cost = Number((cost.item.production_cost * discountFactor).toFixed(2));
    }
    if (cost.item.unit_production_cost) {
        cost.item.unit_production_cost = Number((cost.item.unit_production_cost * discountFactor).toFixed(4));
    }

    // Adjust the internal numeric totals used for metadata
    cost.setup *= discountFactor;
    cost.production *= discountFactor;
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
