import { QuoteInput } from '../types';
import { PRICING_FORMULAS, PRICING_OPERATIONS } from '@/config/constants';
import { calculateBlockThickness } from './block';
import { calculateCoverProductionType } from './cover';

// ============================================================================
// GLUING OPERATIONS FORMULAS
// ============================================================================
//
// FORMULA OVERVIEW:
// -----------------
// Calculates which gluing operations apply and their production costs.
// Gluing operations can stack (e.g., square spine + manual loading).
//
// THREE GLUING TYPES:
// 1. Gluing Square Spine - Applied when spine_type = 'square'
// 2. Gluing Round Spine - Applied when spine_type = 'round'
// 3. Gluing Manual Loading - Applied ONLY when cover_production_type = 'manual'
//
// PRICING LOGIC:
// - Setup costs: From database (pricing_configs table)
// - Production costs: Tiered pricing based on block thickness or dimensions
//
// EDIT CONSTANTS IN: src/config/constants.ts → PRICING_FORMULAS.GLUING
// ============================================================================

/**
 * Determines which gluing operation slugs apply to the current quote.
 * 
 * LOGIC:
 * - Always includes ONE base gluing: 'gluing_square_spine' OR 'gluing_round_spine'
 * - Optionally adds 'gluing_manual_loading' if cover is manual production
 * 
 * @param input - Quote input containing spine type and cover details
 * @returns Array of operation slugs to apply (1-2 items)
 * 
 * @example
 * // Square spine, standard cover
 * calculateGluingSlugs(input) → ['gluing_square_spine']
 * 
 * @example
 * // Round spine, manual cover
 * calculateGluingSlugs(input) → ['gluing_round_spine', 'gluing_manual_loading']
 */
export function calculateGluingSlugs(input: QuoteInput): string[] {
    const slugs: string[] = [];
    
    // --- STEP 1: Base gluing (always one of these) ---
    if (input.cover_details.spine_type === 'square') {
        slugs.push(PRICING_OPERATIONS.GLUING_SQUARE_SPINE);
    } else if (input.cover_details.spine_type === 'round') {
        slugs.push(PRICING_OPERATIONS.GLUING_ROUND_SPINE);
    }
    
    // --- STEP 2: Additional manual loading (if cover is manual) ---
    const coverType = calculateCoverProductionType(input);
    if (coverType === 'manual') {
        slugs.push(PRICING_OPERATIONS.GLUING_MANUAL_LOADING);
    }
    
    return slugs;
}

/**
 * Calculates the production unit cost for gluing square spine based on block thickness.
 * 
 * FORMULA: Tiered pricing by block thickness
 * - > 50mm → €0.124/unit
 * - 30-50mm → €0.093/unit
 * - ≤ 30mm → €0.062/unit
 * 
 * @param blockThickness - Block thickness in millimeters
 * @returns Production cost per unit in euros
 * 
 * @example
 * // Thick block (60mm)
 * calculateGluingSquareSpineRate(60) → 0.124
 * 
 * @example
 * // Medium block (40mm)
 * calculateGluingSquareSpineRate(40) → 0.093
 * 
 * @example
 * // Thin block (25mm)
 * calculateGluingSquareSpineRate(25) → 0.062
 */
export function calculateGluingSquareSpineRate(blockThickness: number): number {
    const { SQUARE_HIGH_THRESHOLD, SQUARE_MID_THRESHOLD, SQUARE_RATES } = PRICING_FORMULAS.GLUING;
    
    if (blockThickness > SQUARE_HIGH_THRESHOLD) {
        return SQUARE_RATES.HIGH;
    } else if (blockThickness > SQUARE_MID_THRESHOLD) {
        return SQUARE_RATES.MID;
    } else {
        return SQUARE_RATES.LOW;
    }
}

/**
 * Calculates the production unit cost for gluing round spine based on block thickness.
 * 
 * FORMULA: Tiered pricing by block thickness
 * - > 50mm → €0.21/unit
 * - 30-50mm → €0.16/unit
 * - ≤ 30mm → €0.105/unit
 * 
 * @param blockThickness - Block thickness in millimeters
 * @returns Production cost per unit in euros
 * 
 * @example
 * // Thick block (60mm)
 * calculateGluingRoundSpineRate(60) → 0.21
 * 
 * @example
 * // Medium block (40mm)
 * calculateGluingRoundSpineRate(40) → 0.16
 * 
 * @example
 * // Thin block (25mm)
 * calculateGluingRoundSpineRate(25) → 0.105
 */
export function calculateGluingRoundSpineRate(blockThickness: number): number {
    const { ROUND_HIGH_THRESHOLD, ROUND_MID_THRESHOLD, ROUND_RATES } = PRICING_FORMULAS.GLUING;
    
    if (blockThickness > ROUND_HIGH_THRESHOLD) {
        return ROUND_RATES.HIGH;
    } else if (blockThickness > ROUND_MID_THRESHOLD) {
        return ROUND_RATES.MID;
    } else {
        return ROUND_RATES.LOW;
    }
}

/**
 * Calculates the production unit cost for gluing with manual loading based on book dimensions.
 * 
 * FORMULA: Tiered pricing by height and width
 * Priority 1: Height > 380mm → €0.28/unit
 * Priority 2: Width tiers (if height ≤ 380mm):
 *   - Width ≤ 305mm → €0.28/unit
 *   - 305mm < Width ≤ 310mm → €0.13/unit
 *   - 310mm < Width ≤ 320mm → €0.18/unit
 *   - Width > 320mm → €0.28/unit
 * 
 * @param width - Book width in millimeters
 * @param height - Book height in millimeters
 * @returns Production cost per unit in euros
 * 
 * @example
 * // Tall book (height > 380)
 * calculateGluingManualLoadingRate(300, 400) → 0.28
 * 
 * @example
 * // Narrow book (width ≤ 305)
 * calculateGluingManualLoadingRate(300, 350) → 0.28
 * 
 * @example
 * // Medium width (305 < width ≤ 310)
 * calculateGluingManualLoadingRate(308, 350) → 0.13
 * 
 * @example
 * // Medium-wide (310 < width ≤ 320)
 * calculateGluingManualLoadingRate(315, 350) → 0.18
 * 
 * @example
 * // Wide book (width > 320)
 * calculateGluingManualLoadingRate(325, 350) → 0.28
 */
export function calculateGluingManualLoadingRate(width: number, height: number): number {
    const { 
        MANUAL_HEIGHT_THRESHOLD, 
        MANUAL_WIDTH_TIER_1, 
        MANUAL_WIDTH_TIER_2, 
        MANUAL_WIDTH_TIER_3,
        MANUAL_RATES 
    } = PRICING_FORMULAS.GLUING;
    
    // --- PRIORITY 1: Height check (overrides width) ---
    if (height > MANUAL_HEIGHT_THRESHOLD) {
        return MANUAL_RATES.DEFAULT;
    }
    
    // --- PRIORITY 2: Width tiers ---
    if (width <= MANUAL_WIDTH_TIER_1) {
        return MANUAL_RATES.DEFAULT;
    } else if (width <= MANUAL_WIDTH_TIER_2) {
        return MANUAL_RATES.TIER_2;
    } else if (width <= MANUAL_WIDTH_TIER_3) {
        return MANUAL_RATES.TIER_3;
    } else {
        return MANUAL_RATES.DEFAULT;
    }
}

/**
 * Calculates the production unit cost for a specific gluing operation.
 * 
 * This is the main entry point used by the pricing engine.
 * Routes to the appropriate calculation based on operation slug.
 * 
 * @param slug - Operation slug ('gluing_square_spine', 'gluing_round_spine', 'gluing_manual_loading')
 * @param input - Quote input containing all necessary data
 * @returns Production cost per unit in euros
 * 
 * @example
 * calculateGluingProductionRate('gluing_square_spine', input) → 0.093
 */
export function calculateGluingProductionRate(slug: string, input: QuoteInput): number {
    const blockThickness = calculateBlockThickness(input);
    const { width, height } = input.format;
    
    switch (slug) {
        case PRICING_OPERATIONS.GLUING_SQUARE_SPINE:
            return calculateGluingSquareSpineRate(blockThickness);
        
        case PRICING_OPERATIONS.GLUING_ROUND_SPINE:
            return calculateGluingRoundSpineRate(blockThickness);
        
        case PRICING_OPERATIONS.GLUING_MANUAL_LOADING:
            return calculateGluingManualLoadingRate(width, height);
        
        default:
            return 0;
    }
}
