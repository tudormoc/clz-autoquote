import { QuoteInput } from '../types';
import { PRICING_FORMULAS } from '@/config/constants';

// ============================================================================
// COVER PRODUCTION TYPE LOGIC
// ============================================================================
//
// DECISION TREE:
// --------------
// 1. MANUAL (Highest Priority)
//    → Width > 305mm OR Height > 380mm
//    → Requires manual production due to size
//
// 2. FAST (All conditions must be true)
//    → Width: 100-295mm
//    → Height: 120-380mm
//    → No headbands
//    → Quantity ≥ 1000
//    → Square spine
//
// 3. STANDARD (Default)
//    → Everything else
//
// EDIT THRESHOLDS IN: src/config/constants.ts → PRICING_FORMULAS.COVER
// ============================================================================

/**
 * Automatically determines the cover production type based on book specifications.
 * 
 * The production type affects which pricing rule is applied:
 * - manual: Higher cost, used for oversized books
 * - fast: Lower cost, used for high-volume standard books
 * - standard: Default cost, used for most books
 * 
 * @param input - Quote input containing format and cover details
 * @returns Production type: 'manual', 'fast', or 'standard'
 * 
 * @example
 * // Large book (350mm × 400mm)
 * calculateCoverProductionType(input) → 'manual'
 * 
 * @example
 * // High-volume standard book (148mm × 210mm, 2000 qty, square spine, no headbands)
 * calculateCoverProductionType(input) → 'fast'
 * 
 * @example
 * // Regular book with headbands
 * calculateCoverProductionType(input) → 'standard'
 */
export function calculateCoverProductionType(input: QuoteInput): 'standard' | 'fast' | 'manual' {
    const { width, height } = input.format;
    const { headbands_enabled, spine_type } = input.cover_details;
    const { quantity } = input;

    // --- PRIORITY 1: MANUAL CHECK (Overrides everything) ---
    // If book is too large, must use manual production
    if (width > PRICING_FORMULAS.COVER.MANUAL_WIDTH_THRESHOLD || 
        height > PRICING_FORMULAS.COVER.MANUAL_HEIGHT_THRESHOLD) {
        return 'manual';
    }

    // --- PRIORITY 2: FAST CHECK (All conditions must be true) ---
    const isFastWidth = width > PRICING_FORMULAS.COVER.FAST_MIN_WIDTH && 
                        width < PRICING_FORMULAS.COVER.FAST_MAX_WIDTH;
    const isFastHeight = height > PRICING_FORMULAS.COVER.FAST_MIN_HEIGHT && 
                         height < PRICING_FORMULAS.COVER.FAST_MAX_HEIGHT;
    const hasNoHeadbands = !headbands_enabled;
    const isBulkOrder = quantity >= PRICING_FORMULAS.COVER.FAST_MIN_QUANTITY;
    const isSquareSpine = spine_type === PRICING_FORMULAS.COVER.FAST_SPINE_TYPE;

    if (isFastWidth && isFastHeight && hasNoHeadbands && isBulkOrder && isSquareSpine) {
        return 'fast';
    }

    // --- PRIORITY 3: STANDARD (Default fallback) ---
    return 'standard';
}
