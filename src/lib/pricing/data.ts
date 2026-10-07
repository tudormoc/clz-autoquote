import { queryMSSQL } from '../mssql';
import { PricingRule, DiscountTier, SignatureType } from './types';
import { FormatSurcharge } from '@/types';

/** Numbers can come back from SQL Server as text (decimal columns), hence number | string */
type Num = number | string;

interface PricingRuleRow {
    id: string;
    operation_id: string;
    slug: string;
    operation_name: string;
    description: string | null;
    category: PricingRule['category'];
    setup_base_cost: Num;
    setup_variable_factor: Num;
    production_base_cost: Num;
    production_variable_factor: Num;
    active: boolean;
    discount_multiplier_setup: Num | null;
    discount_multiplier_production: Num | null;
    surcharge_multiplier_setup: Num | null;
    surcharge_multiplier_production: Num | null;
}

interface DiscountTierRow { id: string | number; min_quantity: Num; max_quantity: Num | null; discount_percentage: Num }
interface SignatureTypeRow { id: string; name: string; pages: Num; unit_price: Num | null; sort_order: Num; is_active: boolean | number }
interface FormatSurchargeRow { id: string | number; width_min: Num; width_max: Num; height_min: Num; height_max: Num; surcharge_percentage: Num }

/**
 * Fetches all active pricing rules (Operation + Config) from MSSQL.
 */
export async function getPricingRules(): Promise<PricingRule[]> {
    try {
        const result = await queryMSSQL<PricingRuleRow>(`
            SELECT 
                pc.*,
                o.slug,
                o.name as operation_name,
                o.description,
                o.category,
                o.discount_multiplier_setup,
                o.discount_multiplier_production,
                o.surcharge_multiplier_setup,
                o.surcharge_multiplier_production
            FROM pricing_configs pc
            JOIN operations o ON pc.operation_id = o.id
            WHERE pc.active = 1
        `, {}, 'QUOTES');

        return (result.recordset || []).map((row) => ({
            id: row.id,
            operation_id: row.operation_id,
            slug: row.slug,
            name: row.operation_name,
            operation_name: row.operation_name,
            description: row.description,
            category: row.category,
            setup_base_cost: Number(row.setup_base_cost),
            setup_variable_factor: Number(row.setup_variable_factor),
            production_base_cost: Number(row.production_base_cost),
            production_variable_factor: Number(row.production_variable_factor),
            active: row.active,
            discount_multiplier_setup: row.discount_multiplier_setup !== null && row.discount_multiplier_setup !== undefined ? Number(row.discount_multiplier_setup) : 1.0,
            discount_multiplier_production: row.discount_multiplier_production !== null && row.discount_multiplier_production !== undefined ? Number(row.discount_multiplier_production) : 1.0,
            surcharge_multiplier_setup: row.surcharge_multiplier_setup !== null && row.surcharge_multiplier_setup !== undefined ? Number(row.surcharge_multiplier_setup) : 1.0,
            surcharge_multiplier_production: row.surcharge_multiplier_production !== null && row.surcharge_multiplier_production !== undefined ? Number(row.surcharge_multiplier_production) : 1.0
        })) as PricingRule[];
    } catch (error) {
        console.error('Error fetching pricing rules from MSSQL:', error);
        return [];
    }
}

/**
 * Fetches volume discount tiers from MSSQL.
 */
export async function getDiscountTiers(): Promise<DiscountTier[]> {
    try {
        const result = await queryMSSQL<DiscountTierRow>(
            'SELECT * FROM discount_tiers ORDER BY min_quantity ASC',
            {},
            'QUOTES'
        );

        return (result.recordset || []).map((row) => ({
            id: row.id,
            min_quantity: Number(row.min_quantity),
            max_quantity: row.max_quantity ? Number(row.max_quantity) : null,
            discount_percentage: Number(row.discount_percentage)
        }));
    } catch (error) {
        console.error('Error fetching discount tiers from MSSQL:', error);
        return [];
    }
}

/**
 * Fetches signature types from MSSQL.
 */
export async function getSignatureTypes(): Promise<SignatureType[]> {
    try {
        const result = await queryMSSQL<SignatureTypeRow>(
            'SELECT * FROM signature_types WHERE is_active = 1 ORDER BY sort_order ASC',
            {},
            'QUOTES'
        );

        return (result.recordset || []).map((row) => ({
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

/**
 * Fetches format surcharges from MSSQL.
 */
export async function getFormatSurcharges(): Promise<FormatSurcharge[]> {
    try {
        const result = await queryMSSQL<FormatSurchargeRow>(
            'SELECT * FROM format_surcharges ORDER BY width_min ASC, height_min ASC',
            {},
            'QUOTES'
        );

        return (result.recordset || []).map((row) => ({
            id: row.id,
            width_min: Number(row.width_min),
            width_max: Number(row.width_max),
            height_min: Number(row.height_min),
            height_max: Number(row.height_max),
            surcharge_percentage: Number(row.surcharge_percentage)
        }));
    } catch (error) {
        console.error('Error fetching format surcharges from MSSQL:', error);
        return [];
    }
}
