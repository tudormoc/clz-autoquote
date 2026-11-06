/**
 * What differs on one edition, by kind (quantities, article data, phases, materials): the four comparisons of the tabs
 * made in one place, for the Gestione panel, the "Disallineato da DiBa" badge and the list of the orders to realign,
 * so the three always agree. Pure. See docs/ORDER_PROCESS.md.
 */
import { APP_CONFIG } from '@/config/constants';
import { ARTICLE_RULES } from '@/lib/orders/article';
import { compareMaterials, compareOperations } from '@/lib/orders/compare';
import { compareFacts } from '@/lib/orders/documentFacts';
import { QUANTITY_RULES } from '@/lib/orders/quantities';
import { previewSync, type SyncChangeGroupKey, type SyncPreviewInput } from '@/lib/orders/syncPreview';
import type { OrderOperationsManagementData } from '@/types';

/** The comparison each kind of difference comes from, in the order Riallinea works */
const KIND_ROWS: [SyncChangeGroupKey, keyof SyncPreviewInput][] = [
    ['quantity', 'quantities'],
    ['article', 'article'],
    ['phases', 'phases'],
    ['materials', 'materials'],
];
export const DIFFERENCE_KINDS = KIND_ROWS.map(([kind]) => kind);

/** The differences of one kind on an edition */
export interface OrderDifference {
    kind: SyncChangeGroupKey;
    /** Rows of the kind's tab that differ (a phase, a material, a quantity, an article datum): what the badge counts */
    count: number;
    /** What Riallinea would change, one line per place or row (the lines of its confirm window) */
    changes: string[];
    /** What the comparison says where Riallinea has nothing to change (no impegno cliente, an order missing) */
    issues: string[];
}

/** The lines that say what differs: the changes of a realign, else the issues of the comparison */
export const differenceLines = (difference: OrderDifference) => (difference.changes.length > 0 ? difference.changes : difference.issues);

/** The four comparisons of an edition, as the tabs show them */
export function compareOrder(data: OrderOperationsManagementData): SyncPreviewInput {
    const quantity = data.order_father_quant || APP_CONFIG.ORDERS.DEFAULT_QUANTITY;
    return {
        quantities: compareFacts(data.quantities?.rows ?? [], QUANTITY_RULES),
        article: compareFacts(data.article?.rows ?? [], ARTICLE_RULES),
        phases: compareOperations(data.diba_operations, data.business_operations ?? [], data.order_operations),
        materials: compareMaterials(data.diba_materials ?? [], data.order_materials ?? [], data.netpro_materials ?? [], quantity),
    };
}

/** The rows of one comparison that differ */
const differing = (rows: { issues: string[] }[]) => rows.filter((row) => row.issues.length > 0);

/** The kinds that differ, each with its number of differing rows and the lines of the Riallinea preview */
export function orderDifferences(comparisons: SyncPreviewInput): OrderDifference[] {
    const preview = previewSync(comparisons);
    return KIND_ROWS.flatMap(([kind, key]) => {
        const rows = differing(comparisons[key]);
        if (rows.length === 0) return [];
        const changes = preview.find((group) => group.key === kind)?.changes ?? [];
        return [{ kind, count: rows.length, changes, issues: changes.length > 0 ? [] : Array.from(new Set(rows.flatMap((row) => row.issues))) }];
    });
}

/** Number of differing rows over the four kinds (the "Disallineato da DiBa" badge) */
export const countDifferences = (comparisons: SyncPreviewInput) =>
    KIND_ROWS.reduce((total, [, key]) => total + differing(comparisons[key]).length, 0);
