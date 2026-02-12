import { QuoteInput } from '../types';
import { PRICING_FORMULAS } from '@/config/constants';

// ============================================================================
// BLOCK THICKNESS CALCULATION
// ============================================================================
//
// FORMULA OVERVIEW:
// -----------------
// Calculates the physical thickness of the book block (text pages) in millimeters.
// This value is critical for spine calculations, gluing operations, and cover sizing.
//
// The formula accounts for:
// 1. Internal sheets (pages) - based on paper weight, thickness, and page count
// 2. Endpapers (optional) - adds 8 pages (4 sheets) if enabled
//
// FORMULA STEPS:
// 1. Sheets Thickness = (sheet_weight × sheet_thickness / 1000) × (pages / 2)
// 2. Endpapers Thickness = (endpaper_weight × endpaper_thickness / 1000) × (8 / 2)
// 3. Total Block Thickness = Sheets Thickness + Endpapers Thickness (if enabled)
//
// EXAMPLE CALCULATION:
// --------------------
// Input: 200 pages, 170gsm sheets, 1.5mm thickness, endpapers enabled (170gsm, 1.5mm)
// Step 1: (170 × 1.5 / 1000) × (200 / 2) = 0.255 × 100 = 25.5mm
// Step 2: (170 × 1.5 / 1000) × (8 / 2) = 0.255 × 4 = 1.02mm
// Final: 25.5 + 1.02 = 26.52mm
//
// EDIT CONSTANTS IN: src/config/constants.ts → PRICING_FORMULAS.BLOCK
// ============================================================================

/**
 * Calculates the total thickness of the book block in millimeters.
 * 
 * FORMULA: 
 * - With endpapers: (sheet_weight × sheet_thickness / 1000 × pages / 2) + (endpaper_weight × endpaper_thickness / 1000 × 8 / 2)
 * - Without endpapers: sheet_weight × sheet_thickness / 1000 × pages / 2
 * 
 * The block thickness is essential for:
 * - Spine width calculations
 * - Gluing operation complexity
 * - Cover material sizing
 * - Binding machine setup
 * 
 * @param input - Quote input containing page count, sheet specs, and endpaper configuration
 * @returns Block thickness in millimeters (mm)
 * 
 * @example
 * // Standard book: 200 pages, 170gsm, 1.5mm thickness, no endpapers
 * const input = { 
 *   pages: 200, 
 *   internals: { 
 *     sheet_weight: 170, 
 *     sheet_thickness: 1.5, 
 *     endpapers_enabled: false 
 *   } 
 * };
 * calculateBlockThickness(input) → 25.5
 * // Calculation: (170 × 1.5 / 1000) × (200 / 2) = 25.5mm
 * 
 * @example
 * // Premium book: 300 pages, 200gsm, 2.0mm thickness, with endpapers (200gsm, 2.0mm)
 * const input = { 
 *   pages: 300, 
 *   internals: { 
 *     sheet_weight: 200, 
 *     sheet_thickness: 2.0, 
 *     endpapers_enabled: true,
 *     endpapers_weight: 200,
 *     endpapers_thickness: 2.0
 *   } 
 * };
 * calculateBlockThickness(input) → 64.0
 * // Calculation: (200 × 2.0 / 1000) × (300 / 2) + (200 × 2.0 / 1000) × (8 / 2) = 60.0 + 4.0 = 64.0mm
 */
export function calculateBlockThickness(input: QuoteInput): number {
    const { pages, internals } = input;
    const { 
        sheet_weight = 0, 
        sheet_thickness = 0, 
        endpapers_enabled = false,
        endpapers_weight = 0,
        endpapers_thickness = 0
    } = internals;

    // --- STEP 1: Calculate internal sheets thickness ---
    // Formula: (sheet_weight × sheet_thickness / 1000) × (pages / 2)
    // Dividing by 1000 converts gsm to proper density factor
    // Dividing pages by 2 converts pages to sheets (2 pages per sheet)
    const sheetsThickness = (sheet_weight * sheet_thickness / PRICING_FORMULAS.BLOCK.DENSITY_DIVISOR) 
                          * (pages / PRICING_FORMULAS.BLOCK.PAGES_PER_SHEET);

    // --- STEP 2: Calculate endpapers thickness (if enabled) ---
    // Formula: (endpaper_weight × endpaper_thickness / 1000) × (8 / 2)
    // Endpapers add 8 pages (4 sheets) to the block
    let endpapersThickness = 0;
    if (endpapers_enabled) {
        endpapersThickness = (endpapers_weight * endpapers_thickness / PRICING_FORMULAS.BLOCK.DENSITY_DIVISOR) 
                           * (PRICING_FORMULAS.BLOCK.ENDPAPER_PAGES / PRICING_FORMULAS.BLOCK.PAGES_PER_SHEET);
    }

    // --- FINAL: Total block thickness ---
    // Formula: Sheets + Endpapers
    return sheetsThickness + endpapersThickness;
}

/**
 * Formats block thickness for display with appropriate precision.
 * 
 * @param thickness - Block thickness in millimeters
 * @returns Formatted string with unit (e.g., "25.5mm")
 * 
 * @example
 * formatBlockThickness(25.52) → "25.5mm"
 * formatBlockThickness(64.0) → "64.0mm"
 */
export function formatBlockThickness(thickness: number): string {
    return `${thickness.toFixed(1)}mm`;
}

// ============================================================================
// INTEGRATION NOTES
// ============================================================================
//
// This formula is used by:
// - Gluing operations (complexity based on block thickness)
// - Spine calculations (width = block thickness + board thickness)
// - Cover sizing (total dimensions including spine)
// - Future binding operations
//
// To display in UI:
// - Add to LiveBreakdown.tsx as an info badge
// - Use formatBlockThickness() for consistent display
//
// ============================================================================
