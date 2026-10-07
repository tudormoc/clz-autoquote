import { PricingRule, CostItem } from '../types';

// ============================================================================
// GENERIC OPERATION COST FORMULA
// ============================================================================
//
// FORMULA OVERVIEW:
// -----------------
// This is the core formula used by ALL pricing operations (CFGS, Cover, etc.)
//
// 1. Setup Cost = setup_base_cost + (setup_variable_factor × complexityFactor)
//    - Base cost: Fixed cost to set up the operation
//    - Variable: Additional cost per complexity unit
//
// 2. Unit Production Rate = production_base_cost + (production_variable_factor × complexityFactor)
//    - Can be overridden by specific formulas (e.g., CFGS uses signature-based rate)
//
// 3. Total Production Cost = Unit Rate × Quantity
//
// 4. Total Cost = Setup Cost + Total Production Cost
//
// EXAMPLE (CFGS with 15 signatures, 1000 quantity):
// - Complexity = 14 (15 signatures - 1)
// - Setup = 100 + (2 × 14) = €128
// - Unit Rate = 0.006 (from signature types)
// - Production = 0.006 × 1000 = €6
// - Total = €128 + €6 = €134
//
// ============================================================================

/**
 * Calculates cost for a single operation using the standard pricing formula.
 * 
 * This function is used by all pricing operations (CFGS, Cover Production, etc.)
 * to calculate setup and production costs based on pricing rules.
 * 
 * @param rule - Pricing rule from database containing base costs and factors
 * @param quantity - Number of units to produce
 * @param complexityFactor - Job complexity (e.g., number of signatures - 1)
 * @param overrideUnitRate - Optional custom unit rate (used by CFGS for signature-based pricing)
 * @returns Object containing setup cost, production cost, and formatted cost item
 * 
 * @example
 * // Standard operation (no override)
 * calculateOperationCost(rule, 1000, 14)
 * // → Uses rule's production formula
 * 
 * @example
 * // CFGS with custom signature-based rate
 * calculateOperationCost(rule, 1000, 14, 6.0000)
 * // → Uses 6.0000 as unit rate instead of rule's formula
 */
export function calculateOperationCost(
    rule: PricingRule,
    quantity: number,
    complexityFactor: number,
    overrideUnitRate?: number
): { setup: number; production: number; item: CostItem } {
    // SETUP COST FORMULA
    // Setup = base + (variable_factor × complexity)
    const setupCost = rule.setup_base_cost + (rule.setup_variable_factor * complexityFactor);

    // UNIT PRODUCTION RATE FORMULA
    // Rate = base + (variable_factor × complexity)
    // OR use override rate if provided (e.g., from CFGS signature calculation)
    const unitProdRate = overrideUnitRate ?? (rule.production_base_cost + (rule.production_variable_factor * complexityFactor));
    
    // TOTAL PRODUCTION COST FORMULA
    // Production = Unit Rate × Quantity
    const totalProdCost = unitProdRate * quantity;

    return {
        setup: setupCost,
        production: totalProdCost,
        item: {
            id: rule.slug,
            name: rule.operation_name,
            cost: Number((setupCost + totalProdCost).toFixed(2)),
            setup_cost: Number(setupCost.toFixed(2)),
            production_cost: Number(totalProdCost.toFixed(2)),
            unit_production_cost: Number(unitProdRate.toFixed(4))
        }
    };
}
