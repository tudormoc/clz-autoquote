import { PricingRule, CostItem } from '../types';

/**
 * Calculates cost for a single operation.
 * Returns Setup Cost and Total Production Cost (Rate * Qty).
 */
export function calculateOperationCost(
    rule: PricingRule,
    quantity: number,
    complexityFactor: number,
    overrideUnitRate?: number
): { setup: number; production: number; item: CostItem } {
    const setupCost = rule.setup_base_cost + (rule.setup_variable_factor * complexityFactor);

    const unitProdRate = overrideUnitRate ?? (rule.production_base_cost + (rule.production_variable_factor * complexityFactor));
    const totalProdCost = unitProdRate * quantity;

    return {
        setup: setupCost,
        production: totalProdCost,
        item: {
            id: rule.slug,
            name: rule.operation_name,
            type: 'production' as const,
            cost: Number((setupCost + totalProdCost).toFixed(2)),
            setup_cost: Number(setupCost.toFixed(2)),
            production_cost: Number(totalProdCost.toFixed(2)),
            unit_production_cost: Number(unitProdRate.toFixed(4)),
            details: `Setup: ${setupCost.toFixed(2)} | Prod: ${unitProdRate.toFixed(4)}/unit`
        }
    };
}
