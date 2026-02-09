import { DiscountTier, CostItem } from '../types';

/**
 * Finds the applicable discount tier for a given quantity.
 */
export function findDiscountTier(quantity: number, tiers: DiscountTier[]): DiscountTier | null {
    return tiers.find(t =>
        quantity >= t.min_quantity &&
        (t.max_quantity === null || quantity <= t.max_quantity)
    ) || null;
}

/**
 * Calculates the discount factor (1 - discount_percentage).
 * Returns 1 if no discount applies.
 */
export function calculateDiscountFactor(tier: DiscountTier | null): number {
    return tier ? (1 - tier.discount_percentage) : 1;
}

/**
 * Applies volume discount to a cost item and its internal tracking values.
 */
export function applyDiscountToItem(
    cost: { setup: number; production: number; item: CostItem },
    discountFactor: number,
    label: string | null
): void {
    if (discountFactor >= 1) return;

    // Store the discount percentage in the item (e.g., 0.15 for 15% discount)
    cost.item.discount_percentage = 1 - discountFactor;

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
 * Generates a human-readable discount label.
 */
export function getDiscountLabel(tier: DiscountTier | null): string | null {
    if (!tier || tier.discount_percentage <= 0) return null;
    return `${(tier.discount_percentage * 100).toFixed(0)}% volume discount`;
}
