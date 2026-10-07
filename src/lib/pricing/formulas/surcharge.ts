import { FormatSurcharge } from '@/types';
import { CostItem } from '../types';

// ============================================================================
// FORMAT SURCHARGE FORMULAS
// ============================================================================
//
// FORMULA OVERVIEW:
// -----------------
// 1. Find Width Surcharge
//    → Match width to surcharge range (width_min ≤ width ≤ width_max)
//
// 2. Find Height Surcharge
//    → Match height to surcharge range (height_min ≤ height ≤ height_max)
//
// 3. Apply Maximum Surcharge
//    → Use the higher of width or height surcharge
//    → Example: Width = 10%, Height = 20% → Apply 20%
//
// 4. Calculate Surcharge Factor
//    → Factor = 1 + surcharge_percentage
//    → Example: 20% surcharge → factor = 1 + 0.20 = 1.20
//
// 5. Apply Surcharge
//    → Surcharged Price = Original Price × Factor
//    → Example: €100 × 1.20 = €120
//
// NOTE: Surcharges are applied BEFORE discounts in the pricing engine
//
// EDIT SURCHARGE RANGES IN: Admin Dashboard → Format Surcharges Manager
// ============================================================================

/**
 * Finds the applicable format surcharge for width dimension.
 * 
 * @param width - Book width in millimeters
 * @param surcharges - Available format surcharges from database
 * @returns Surcharge percentage (e.g., 0.20 for 20% surcharge) or 0
 * 
 * @example
 * // Surcharge: 400-500mm width = 20%
 * findWidthSurcharge(450, surcharges) → 0.20
 * findWidthSurcharge(300, surcharges) → 0 (no surcharge)
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
 * 
 * @param height - Book height in millimeters
 * @param surcharges - Available format surcharges from database
 * @returns Surcharge percentage (e.g., 0.20 for 20% surcharge) or 0
 * 
 * @example
 * // Surcharge: 400-500mm height = 20%
 * findHeightSurcharge(450, surcharges) → 0.20
 * findHeightSurcharge(300, surcharges) → 0 (no surcharge)
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
 * Finds the maximum surcharge between width and height dimensions.
 * 
 * FORMULA: max(widthSurcharge, heightSurcharge)
 * 
 * We apply the higher surcharge to avoid double-charging for oversized formats.
 * 
 * @param width - Book width in millimeters
 * @param height - Book height in millimeters
 * @param surcharges - Available format surcharges from database
 * @returns Maximum surcharge percentage to apply
 * 
 * @example
 * // Width: 450mm (20% surcharge), Height: 300mm (10% surcharge)
 * findMaxFormatSurcharge(450, 300, surcharges) → 0.20 (use higher)
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
 * Calculates the surcharge factor to multiply prices by.
 * 
 * FORMULA: Factor = 1 + surcharge_percentage
 * 
 * @param surchargePercentage - Surcharge percentage (e.g., 0.20 for 20%)
 * @returns Surcharge factor (1.0 = no surcharge, 1.20 = 20% surcharge)
 * 
 * @example
 * calculateSurchargeFactor(0) → 1.0 (no surcharge)
 * calculateSurchargeFactor(0.10) → 1.10 (10% surcharge)
 * calculateSurchargeFactor(0.20) → 1.20 (20% surcharge)
 */
export function calculateSurchargeFactor(surchargePercentage: number): number {
    return surchargePercentage > 0 ? (1 + surchargePercentage) : 1;
}

/**
 * Applies format surcharge to a cost item and its internal tracking values.
 * 
 * This function modifies the cost object in-place, applying the surcharge
 * to setup and production components separately based on their multipliers.
 * 
 * @param cost - Cost object containing setup, production, and item details
 * @param surchargeFactor - Base surcharge factor (e.g., 1.20 for 20% surcharge)
 * @param setupMultiplier - Multiplier for setup surcharge (0.0-1.0, default 1.0)
 * @param productionMultiplier - Multiplier for production surcharge (0.0-1.0, default 1.0)
 * 
 * @example
 * // Before: { cost: 100, setup_cost: 20, production_cost: 80 }
 * // Apply 20% surcharge: 100% to setup, 50% to production
 * applySurchargeToItem(cost, 1.20, 1.0, 0.5)
 * // After: { cost: 112, setup_cost: 24 (20*1.20), production_cost: 88 (80*1.10) }
 */
export function applySurchargeToItem(
    cost: { setup: number; production: number; item: CostItem },
    surchargeFactor: number,
    setupMultiplier: number = 1.0,
    productionMultiplier: number = 1.0
): void {
    // No surcharge to apply
    if (surchargeFactor <= 1) return;

    // Calculate adjusted surcharge factors for setup and production
    // Formula: adjustedFactor = 1 + ((baseFactor - 1) * multiplier)
    // Example: 20% surcharge with 0.5 multiplier = 1 + ((1.20 - 1) * 0.5) = 1.10 (10% surcharge)
    const setupSurchargeFactor = 1 + ((surchargeFactor - 1) * setupMultiplier);
    const productionSurchargeFactor = 1 + ((surchargeFactor - 1) * productionMultiplier);

    // Store original values before applying surcharge
    if (cost.item.setup_cost) {
        cost.item.original_setup_cost = cost.item.setup_cost;
    }
    if (cost.item.unit_production_cost) {
        cost.item.original_unit_production_cost = cost.item.unit_production_cost;
    }

    // Apply surcharge to setup
    const surchargedSetup = cost.setup * setupSurchargeFactor;
    if (cost.item.setup_cost) {
        cost.item.setup_cost = Number((cost.item.setup_cost * setupSurchargeFactor).toFixed(2));
    }

    // Apply surcharge to production
    const surchargedProduction = cost.production * productionSurchargeFactor;
    if (cost.item.production_cost) {
        cost.item.production_cost = Number((cost.item.production_cost * productionSurchargeFactor).toFixed(2));
    }
    if (cost.item.unit_production_cost) {
        cost.item.unit_production_cost = Number((cost.item.unit_production_cost * productionSurchargeFactor).toFixed(4));
    }

    // Update total cost
    cost.item.cost = Number((surchargedSetup + surchargedProduction).toFixed(2));

    // Adjust the internal numeric totals used for metadata
    cost.setup = surchargedSetup;
    cost.production = surchargedProduction;
}

/**
 * Generates a human-readable surcharge label for display.
 * 
 * @param surchargePercentage - Surcharge percentage (e.g., 0.20 for 20%)
 * @returns Label string (e.g., "20% format surcharge") or null
 * 
 * @example
 * getSurchargeLabel(0) → null
 * getSurchargeLabel(0.10) → "10% format surcharge"
 * getSurchargeLabel(0.20) → "20% format surcharge"
 */
export function getSurchargeLabel(surchargePercentage: number): string | null {
    if (surchargePercentage <= 0) return null;
    return `${(surchargePercentage * 100).toFixed(0)}% format surcharge`;
}
