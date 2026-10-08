/**
 * Writes of the price rules (Impostazioni → Regole di prezzo). A price rule is an `operations` row (code, name,
 * category, discount / surcharge shares) with its `pricing_configs` row (the costs): both are created and deleted
 * together, in one transaction.
 */
import { z } from 'zod';
import { OPERATION_CATEGORIES, REQUIRED_OPERATION_SLUGS } from '@/config/constants';
import { queryMSSQL } from '@/lib/mssql';
import { errorMessage } from '@/lib/utils';
import { APP_COPY, fmt } from '@/locales';

type Saved = { success: true } | { success: false; error: string };

const copy = APP_COPY.admin.pricingRules;

/** What the "Nuova operazione" window sends */
const NewPricingRuleSchema = z.object({
    slug: z.string().trim().min(1),
    name: z.string().trim().min(1),
    category: z.enum(OPERATION_CATEGORIES),
    setup_base_cost: z.number(),
    setup_variable_factor: z.number(),
    production_base_cost: z.number(),
    production_variable_factor: z.number(),
});

/** Creates a price rule; a new operation takes the whole discount and surcharge (shares 100%) */
export async function createPricingRule(values: unknown): Promise<Saved> {
    const parsed = NewPricingRuleSchema.safeParse(values);
    if (!parsed.success) return { success: false, error: APP_COPY.common.notAllowed };
    const rule = parsed.data;
    try {
        const taken = await queryMSSQL<{ n: number }>(
            'SELECT COUNT(*) AS n FROM operations WITH (NOLOCK) WHERE slug = @slug',
            { slug: rule.slug },
            'QUOTES'
        );
        if (taken.recordset[0].n > 0) return { success: false, error: fmt(copy.slugTaken, { slug: rule.slug }) };

        await queryMSSQL(`
            SET XACT_ABORT ON;
            BEGIN TRANSACTION;
            INSERT INTO operations (id, slug, name, description, category,
                discount_multiplier_setup, discount_multiplier_production, surcharge_multiplier_setup, surcharge_multiplier_production)
            VALUES (@operationId, @slug, @name, '', @category, 1.0, 1.0, 1.0, 1.0);
            INSERT INTO pricing_configs (operation_id, setup_base_cost, setup_variable_factor, production_base_cost, production_variable_factor, active)
            VALUES (@operationId, @setupBase, @setupVariable, @productionBase, @productionVariable, 1);
            COMMIT TRANSACTION;
        `, {
            operationId: crypto.randomUUID(),
            slug: rule.slug,
            name: rule.name,
            category: rule.category,
            setupBase: rule.setup_base_cost,
            setupVariable: rule.setup_variable_factor,
            productionBase: rule.production_base_cost,
            productionVariable: rule.production_variable_factor,
        }, 'QUOTES');
        return { success: true };
    } catch (error) {
        console.error('Error creating pricing rule:', error);
        return { success: false, error: errorMessage(error) };
    }
}

/**
 * Deletes a price rule: its prices (pricing_configs) and its operation together, so its code is free again.
 * Rules the quote calculation looks up (REQUIRED_OPERATION_SLUGS) are refused.
 */
export async function deletePricingRule(id: string): Promise<Saved> {
    try {
        const found = await queryMSSQL<{ operation_id: string; slug: string; name: string }>(`
            SELECT pc.operation_id, o.slug, o.name
            FROM pricing_configs pc WITH (NOLOCK)
            JOIN operations o WITH (NOLOCK) ON o.id = pc.operation_id
            WHERE pc.id = @id
        `, { id }, 'QUOTES');
        const rule = found.recordset[0];
        if (!rule) return { success: false, error: copy.notFound };
        if (REQUIRED_OPERATION_SLUGS.includes(rule.slug)) return { success: false, error: fmt(copy.required, { name: rule.name }) };

        await queryMSSQL(`
            SET XACT_ABORT ON;
            BEGIN TRANSACTION;
            DELETE FROM pricing_configs WHERE id = @id;
            DELETE FROM operations
            WHERE id = @operationId
              AND NOT EXISTS (SELECT 1 FROM pricing_configs WHERE operation_id = @operationId);
            COMMIT TRANSACTION;
        `, { id, operationId: rule.operation_id }, 'QUOTES');
        return { success: true };
    } catch (error) {
        console.error('Error deleting pricing rule:', error);
        return { success: false, error: errorMessage(error) };
    }
}
