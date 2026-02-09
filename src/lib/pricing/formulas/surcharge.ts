import { FormatSurcharge } from '@/types';
import { CostItem } from '../types';

/**
 * Finds the applicable format surcharge for width dimension.
 */
export function findWidthSurcharge(
    width: number,
    surcharges: FormatSurcharge[]
): number {
    const match = surcharges.find(s =>
        width >= s.width_min && width <= s.width_max
    );
    return match ? match.surcharge_percentage : 0;
}

/**
 * Finds the applicable format surcharge for height dimension.
 */
export function findHeightSurcharge(
    height: number,
    surcharges: FormatSurcharge[]
): number {
    const match = surcharges.find(s =>
        height >= s.height_min && height <= s.height_max
    );
    return match ? match.surcharge_percentage : 0;
}

/**
 * Finds the maximum surcharge between width and height.
 * Returns the higher percentage to apply.
 */
export function findMaxFormatSurcharge(
    width: number,
    height: number,
    surcharges: FormatSurcharge[]
): number {
    const widthSurcharge = findWidthSurcharge(width, surcharges);
    const heightSurcharge = findHeightSurcharge(height, surcharges);
    return Math.max(widthSurcharge, heightSurcharge);
}

/**
 * Calculates the surcharge factor (1 + surcharge_percentage).
 * Returns 1 if no surcharge applies.
 */
export function calculateSurchargeFactor(surchargePercentage: number): number {
    return surchargePercentage > 0 ? (1 + surchargePercentage) : 1;
}

/**
 * Applies format surcharge to a cost item and its internal tracking values.
 */
export function applySurchargeToItem(
    cost: { setup: number; production: number; item: CostItem },
    surchargeFactor: number,
    surchargePercentage: number
): void {
    if (surchargeFactor <= 1) return;

    // Store the surcharge percentage in the item (e.g., 0.20 for 20% surcharge)
    cost.item.surcharge_percentage = surchargePercentage;

    // Store original values before applying surcharge
    if (cost.item.setup_cost) {
        cost.item.original_setup_cost = cost.item.setup_cost;
    }
    if (cost.item.unit_production_cost) {
        cost.item.original_unit_production_cost = cost.item.unit_production_cost;
    }

    // Apply surcharge to displayed values
    cost.item.cost = Number((cost.item.cost * surchargeFactor).toFixed(2));
    if (cost.item.setup_cost) {
        cost.item.setup_cost = Number((cost.item.setup_cost * surchargeFactor).toFixed(2));
    }
    if (cost.item.production_cost) {
        cost.item.production_cost = Number((cost.item.production_cost * surchargeFactor).toFixed(2));
    }
    if (cost.item.unit_production_cost) {
        cost.item.unit_production_cost = Number((cost.item.unit_production_cost * surchargeFactor).toFixed(4));
    }

    // Adjust the internal numeric totals used for metadata
    cost.setup *= surchargeFactor;
    cost.production *= surchargeFactor;
}

/**
 * Generates a human-readable surcharge label.
 */
export function getSurchargeLabel(surchargePercentage: number): string | null {
    if (surchargePercentage <= 0) return null;
    return `${(surchargePercentage * 100).toFixed(0)}% format surcharge`;
}
