import { queryMSSQL } from '../lib/mssql';
import { PricingRule, DiscountTier } from '../lib/pricing/types';

/**
 * Server-side service to fetch pricing data from Local MSSQL.
 */
export const pricingService = {
    /**
     * Fetches all active pricing rules (Operation + Config)
     */
    getPricingRules: async (): Promise<PricingRule[]> => {
        try {
            const result = await queryMSSQL(`
        SELECT 
          pc.*,
          o.slug,
          o.name as operation_name,
          o.description,
          o.category
        FROM pricing_configs pc
        JOIN operations o ON pc.operation_id = o.id
        WHERE pc.active = 1
      `, {}, 'QUOTES');

            return (result.recordset || []).map((row: any) => ({
                id: row.id,
                slug: row.slug,
                name: row.operation_name,
                operation_name: row.operation_name,
                description: row.description,
                category: row.category,
                setup_base_cost: Number(row.setup_base_cost),
                setup_variable_factor: Number(row.setup_variable_factor),
                production_base_cost: Number(row.production_base_cost),
                production_variable_factor: Number(row.production_variable_factor),
                active: row.active
            })) as PricingRule[];
        } catch (error) {
            console.error('Error fetching pricing rules from MSSQL:', error);
            return [];
        }
    },

    /**
     * Fetches volume discount tiers
     */
    getDiscountTiers: async (): Promise<DiscountTier[]> => {
        try {
            const result = await queryMSSQL(
                'SELECT * FROM discount_tiers ORDER BY min_quantity ASC',
                {},
                'QUOTES'
            );

            return (result.recordset || []).map((row: any) => ({
                id: row.id,
                min_quantity: Number(row.min_quantity),
                max_quantity: row.max_quantity ? Number(row.max_quantity) : null,
                discount_percentage: Number(row.discount_percentage)
            }));
        } catch (error) {
            console.error('Error fetching discount tiers from MSSQL:', error);
            return [];
        }
    },

    /**
     * Fetches signature types
     */
    getSignatureTypes: async () => {
        try {
            const result = await queryMSSQL(
                'SELECT * FROM signature_types WHERE is_active = 1 ORDER BY sort_order ASC',
                {},
                'QUOTES'
            );

            return (result.recordset || []).map((row: any) => ({
                id: row.id,
                name: row.name,
                pages: Number(row.pages),
                unit_price: Number(row.unit_price || 0),
                sort_order: Number(row.sort_order),
                is_active: Boolean(row.is_active)
            }));
        } catch (error) {
            console.error('Error fetching signature types from MSSQL:', error);
            return [];
        }
    }
};
