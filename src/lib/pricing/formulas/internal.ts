import { QuoteInput, SignatureType } from '../types';
import { PRICING_FORMULAS } from '@/config/constants';

// ============================================================================
// CFGS FORMULAS (Cutting, Folding, Gathering, Sewing)
// ============================================================================
//
// FORMULA OVERVIEW:
// -----------------
// 1. Unit Production Rate = Σ(signature_amount × signature_type_unit_price)
//    - Sums up the cost of all signature types used
//    - Falls back to base rate if no custom signatures defined
//
// 2. Complexity Factor = max(MIN_COMPLEXITY, TotalSignatures - COMPLEXITY_BASE)
//    - Example: 15 signatures → 15 - 1 = 14 complexity
//    - Used to calculate setup costs based on job complexity
//
// 3. Total Cost = Setup + (Unit Rate × Quantity)
//    - Setup = setup_base_cost + (setup_variable_factor × Complexity)
//    - Production = Unit Rate × Quantity
//
// EDIT FORMULA CONSTANTS IN: src/config/constants.ts → PRICING_FORMULAS.CFGS
// ============================================================================

/**
 * Calculates the unit production rate for CFGS operations.
 * 
 * FORMULA: Unit Rate = Σ(signature_amount × signature_type_unit_price)
 * 
 * @param input - Quote input containing custom signatures
 * @param signatureTypes - Available signature types with unit prices
 * @param fallbackRate - Default rate if no custom signatures defined
 * @returns Object with the calculated rate and the signatures used (empty when the fallback rate applies)
 * 
 * @example
 * Input: 5x 16pp signatures, 10x 32pp signatures
 * Output: { rate: 6.0000, details: "5x16pp 10x32pp" }
 */
export function calculateCFGSProductionRate(
    input: QuoteInput,
    signatureTypes: SignatureType[],
    fallbackRate: number
): { rate: number; details: string } {
    const customSigs = input.internals.custom_signatures || [];

    // No custom signatures defined - use fallback rate from pricing rule
    if (customSigs.length === 0 || signatureTypes.length === 0) {
        return {
            rate: fallbackRate,
            details: ''
        };
    }

    // Calculate rate by summing (amount × unit_price) for each signature type
    let unitProductionRate = 0;
    let details = '';

    customSigs.forEach(sig => {
        const type = signatureTypes.find(t => t.id === sig.signature_type_id);
        if (type) {
            unitProductionRate += (sig.amount * type.unit_price);
            details += `${sig.amount}x${type.name} `;
        }
    });

    return {
        rate: unitProductionRate,
        details: details.trim()
    };
}

/**
 * Calculates the complexity factor for CFGS operations.
 * 
 * FORMULA: Complexity = max(MIN_COMPLEXITY, TotalSignatures - COMPLEXITY_BASE)
 * 
 * The complexity factor represents how difficult the job is based on the number
 * of signature impositions. More signatures = more complex = higher setup cost.
 * 
 * @param input - Quote input containing custom signatures
 * @returns Complexity factor (0 or higher)
 * 
 * @example
 * 15 signatures → 15 - 1 = 14 complexity
 * 1 signature → 1 - 1 = 0 complexity (minimum)
 * 0 signatures → 0 complexity (minimum)
 */
export function calculateCFGSComplexity(input: QuoteInput): number {
    const customSigs = input.internals.custom_signatures || [];
    const totalSigs = customSigs.reduce((sum, sig) => sum + sig.amount, 0);
    
    return Math.max(
        PRICING_FORMULAS.CFGS.MIN_COMPLEXITY,
        totalSigs - PRICING_FORMULAS.CFGS.COMPLEXITY_BASE
    );
}
