'use client';

/**
 * The settings tables edited with RecordTableEditor: which columns, how each value is typed and shown, what a new row
 * starts with. One config per table and one exported editor component for it (used by MANAGER_COMPONENTS).
 * Client code, because the configs hold functions.
 */
import {
    createPricingRuleAction,
    deletePricingRuleAction,
    getDiscountTiersAction,
    getFormatSurchargesAction,
    getPricingRulesAction,
    getSignatureTypesAction,
} from '@/app/actions';
import { RecordTableEditor } from '@/components/admin/record-editor/RecordTableEditor';
import type { RecordColumn, RecordTableConfig } from '@/components/admin/record-editor/types';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { APP_CONFIG, OPERATION_CATEGORIES, REQUIRED_OPERATION_SLUGS } from '@/config/constants';
import { formatCurrency, formatNumber } from '@/lib/format';
import type { DiscountTier, PricingRule, SignatureType } from '@/lib/pricing/types';
import type { FormatSurcharge } from '@/types';
import { APP_COPY, fmt } from '@/locales';

const admin = APP_COPY.admin;

/** 0.1 → "10%" */
const percentText = (fraction: number | null | undefined) => `${formatNumber((fraction ?? 1) * 100, 0)}%`;

const OPERATIONS = { table: 'operations', idKey: 'operation_id' } as const;

const DISCOUNT_TIERS: RecordTableConfig<DiscountTier> = (() => {
    const t = admin.discountTiers;
    return {
        table: 'discount_tiers',
        load: getDiscountTiersAction,
        columns: [
            { key: 'min_quantity', label: t.minQty, kind: 'integer', show: (row) => formatNumber(row.min_quantity) },
            {
                key: 'max_quantity',
                label: t.maxQty,
                kind: 'optionalInteger',
                placeholder: t.unlimited,
                show: (row) => (row.max_quantity ? formatNumber(row.max_quantity) : t.unlimited),
            },
            {
                key: 'discount_percentage',
                label: t.discount,
                kind: 'percent',
                max: 100,
                show: (row) => <StatusBadge tone="success" mono>{percentText(row.discount_percentage)}</StatusBadge>,
            },
        ],
        add: { label: t.add, dialogTitle: t.dialogTitle, initial: { min_quantity: '0', max_quantity: '', discount_percentage: '0' } },
        deleteConfirm: t.deleteConfirm,
    };
})();

const FORMAT_SURCHARGES: RecordTableConfig<FormatSurcharge> = (() => {
    const t = admin.formatSurcharges;
    return {
        table: 'format_surcharges',
        load: getFormatSurchargesAction,
        columns: [
            { key: 'width_min', label: t.widthMin, kind: 'integer' },
            { key: 'width_max', label: t.widthMax, kind: 'integer' },
            { key: 'height_min', label: t.heightMin, kind: 'integer' },
            { key: 'height_max', label: t.heightMax, kind: 'integer' },
            {
                key: 'surcharge_percentage',
                label: t.surcharge,
                kind: 'percent',
                show: (row) => (
                    <StatusBadge tone={row.surcharge_percentage > 0 ? 'warning' : 'neutral'} mono>
                        {row.surcharge_percentage > 0 && '+'}{percentText(row.surcharge_percentage)}
                    </StatusBadge>
                ),
            },
        ],
        add: {
            label: t.add,
            dialogTitle: t.dialogTitle,
            initial: { width_min: '0', width_max: '0', height_min: '0', height_max: '0', surcharge_percentage: '0' },
        },
        deleteConfirm: t.deleteConfirm,
    };
})();

const SIGNATURE_TYPES: RecordTableConfig<SignatureType> = (() => {
    const t = admin.signatureTypes;
    const { PAGES, SORT_ORDER } = APP_CONFIG.NEW_SIGNATURE;
    return {
        table: 'signature_types',
        load: getSignatureTypesAction,
        columns: [
            { key: 'name', label: t.name, kind: 'text', placeholder: t.namePlaceholder, show: (row) => <span className="font-semibold">{row.name}</span> },
            { key: 'pages', label: t.pages, kind: 'integer', show: (row) => fmt(t.pagesShort, { pages: row.pages }) },
            { key: 'unit_price', label: t.unitPrice, kind: 'decimal', step: '0.0001', show: (row) => formatCurrency(row.unit_price, 4) },
        ],
        add: {
            label: t.add,
            dialogTitle: t.dialogTitle,
            initial: { name: '', pages: String(PAGES), unit_price: '0' },
            extras: () => ({ id: crypto.randomUUID(), sort_order: SORT_ORDER, is_active: 1 }),
        },
        deleteConfirm: t.deleteConfirm,
    };
})();

/** A price rule is a `pricing_configs` row (the costs) joined to an `operations` row (name, category, how much of discount / surcharge applies). */
const PRICING_RULES: RecordTableConfig<PricingRule> = (() => {
    const t = admin.pricingRules;
    const multiplier = (key: keyof PricingRule & string, label: string, title: string): RecordColumn<PricingRule> => ({
        key,
        label,
        title,
        kind: 'percent',
        max: 100,
        storedIn: OPERATIONS,
        show: (row) => <span className="font-mono">{percentText(row[key as keyof PricingRule] as number | undefined)}</span>,
    });
    const cost = (key: keyof PricingRule & string, label: string, step: string, show: (value: number) => string): RecordColumn<PricingRule> => ({
        key,
        label,
        kind: 'decimal',
        step,
        show: (row) => <span className="font-mono">{show(row[key as keyof PricingRule] as number)}</span>,
    });

    const name: RecordColumn<PricingRule> = {
        key: 'name',
        label: t.operation,
        kind: 'text',
        placeholder: t.namePlaceholder,
        storedIn: OPERATIONS,
        show: (row) => (
            <div className="flex flex-col">
                <span className="font-semibold text-fg">{row.name || row.operation_name}</span>
                <span className="text-3xs font-mono text-fg-subtle">{row.slug}</span>
            </div>
        ),
    };
    const category: RecordColumn<PricingRule> = {
        key: 'category',
        label: t.category,
        kind: 'choice',
        options: OPERATION_CATEGORIES.map((value) => ({ value, label: admin.operationCategories[value] })),
        storedIn: OPERATIONS,
        show: (row) => admin.operationCategories[row.category],
    };
    const setupBase = cost('setup_base_cost', t.setupBase, '0.01', (v) => formatCurrency(v, 2));
    const setupVariable = cost('setup_variable_factor', t.setupVariable, '0.0001', (v) => formatNumber(v, 4));
    const productionBase = cost('production_base_cost', t.productionBase, '0.0001', (v) => formatCurrency(v, 4));
    // Only in the "new operation" window: the table does not show it
    const productionVariable = cost('production_variable_factor', t.productionVariable, '0.0001', (v) => formatNumber(v, 4));

    return {
        table: 'pricing_configs',
        load: getPricingRulesAction,
        columns: [
            name,
            category,
            setupBase,
            setupVariable,
            productionBase,
            multiplier('discount_multiplier_setup', t.discountSetup, t.discountSetupHint),
            multiplier('discount_multiplier_production', t.discountProduction, t.discountProductionHint),
            multiplier('surcharge_multiplier_setup', t.surchargeSetup, t.surchargeSetupHint),
            multiplier('surcharge_multiplier_production', t.surchargeProduction, t.surchargeProductionHint),
        ],
        groupBy: { key: 'category', groups: OPERATION_CATEGORIES.map((value) => ({ value, label: admin.operationCategories[value] })) },
        add: {
            label: t.add,
            dialogTitle: t.dialogTitle,
            columns: [
                { key: 'slug', label: t.code, kind: 'text', placeholder: t.codePlaceholder },
                { ...name, storedIn: undefined },
                { ...category, storedIn: undefined },
                setupBase,
                setupVariable,
                productionBase,
                productionVariable,
            ],
            initial: {
                slug: '',
                name: '',
                category: 'other',
                setup_base_cost: '0',
                setup_variable_factor: '0',
                production_base_cost: '0',
                production_variable_factor: '0',
            },
            // Operation and prices together, on the server (one transaction)
            create: createPricingRuleAction,
        },
        deleteConfirm: t.deleteConfirm,
        remove: (row) => deletePricingRuleAction(row.id),
        locked: { rows: (row) => REQUIRED_OPERATION_SLUGS.includes(row.slug), title: t.lockedTitle },
    };
})();

export const PricingRulesEditor = () => <RecordTableEditor config={PRICING_RULES} />;
export const DiscountTiersEditor = () => <RecordTableEditor config={DISCOUNT_TIERS} />;
export const FormatSurchargesEditor = () => <RecordTableEditor config={FORMAT_SURCHARGES} />;
export const SignatureTypesEditor = () => <RecordTableEditor config={SIGNATURE_TYPES} />;
