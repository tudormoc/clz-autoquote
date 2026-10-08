/**
 * Settings tables the pages may change (Impostazioni → RecordTableEditor) and, for each, the columns.
 * The server (src/app/admin-actions.ts) refuses any other table or column: the browser only names one of these
 * tables, a row id and a value. Rows are always found by their `id`. All tables are in the QUOTES database.
 *
 * - update: columns a click-to-edit cell may change
 * - insert: columns a new row may be created with ([] = new rows are made by their own action, e.g. price rules)
 * - deletable: whether the trash icon may delete a row (price rules are deleted by deletePricingRuleAction)
 */
interface EditableTable {
    update: readonly string[];
    insert: readonly string[];
    deletable: boolean;
}

const DISCOUNT_TIER_COLUMNS = ['min_quantity', 'max_quantity', 'discount_percentage'] as const;
const FORMAT_SURCHARGE_COLUMNS = ['width_min', 'width_max', 'height_min', 'height_max', 'surcharge_percentage'] as const;
const SIGNATURE_TYPE_COLUMNS = ['name', 'pages', 'unit_price'] as const;

export const EDITABLE_TABLES = {
    discount_tiers: { update: DISCOUNT_TIER_COLUMNS, insert: DISCOUNT_TIER_COLUMNS, deletable: true },
    format_surcharges: { update: FORMAT_SURCHARGE_COLUMNS, insert: FORMAT_SURCHARGE_COLUMNS, deletable: true },
    signature_types: { update: SIGNATURE_TYPE_COLUMNS, insert: [...SIGNATURE_TYPE_COLUMNS, 'id', 'sort_order', 'is_active'], deletable: true },
    /** Prices of a price rule */
    pricing_configs: {
        update: ['setup_base_cost', 'setup_variable_factor', 'production_base_cost', 'production_variable_factor'],
        insert: [],
        deletable: false,
    },
    /** Name, category and discount / surcharge shares of a price rule */
    operations: {
        update: ['name', 'category', 'discount_multiplier_setup', 'discount_multiplier_production', 'surcharge_multiplier_setup', 'surcharge_multiplier_production'],
        insert: [],
        deletable: false,
    },
} as const satisfies Record<string, EditableTable>;

export type EditableTableName = keyof typeof EDITABLE_TABLES;

/** The settings table of a name sent by the browser, or undefined when it is not one of EDITABLE_TABLES */
export function editableTable(name: string): EditableTable | undefined {
    return Object.hasOwn(EDITABLE_TABLES, name) ? EDITABLE_TABLES[name as EditableTableName] : undefined;
}
