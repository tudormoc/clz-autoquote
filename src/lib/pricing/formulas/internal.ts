import { QuoteInput, SignatureType } from '../types';

/**
 * Calculates the unit production rate for CFGS (Cutting, Folding, Gathering, Sewing)
 * based on custom signatures and their types.
 */
export function calculateCFGSProductionRate(
    input: QuoteInput,
    signatureTypes: SignatureType[],
    fallbackRate: number
): { rate: number; details: string } {
    const customSigs = input.internals.custom_signatures || [];

    if (customSigs.length === 0 || signatureTypes.length === 0) {
        return {
            rate: fallbackRate,
            details: 'Std logic'
        };
    }

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
 * Complexity = total signatures - 1 (minimum 0)
 */
export function calculateCFGSComplexity(input: QuoteInput): number {
    const customSigs = input.internals.custom_signatures || [];
    const totalSigs = customSigs.reduce((sum, sig) => sum + sig.amount, 0);
    return Math.max(0, totalSigs - 1);
}
