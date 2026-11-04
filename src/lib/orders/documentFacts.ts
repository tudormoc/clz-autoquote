/**
 * Facts of an order (its quantities, its title) compared across the impegno cliente (the truth: where the experts change
 * them), the Business production order and the NetPro order, the same way as the phases and materials (compare.ts).
 * Pure and generic: the Quantità tab compares numbers (quantities.ts), the Articolo tab text (article.ts); the data is
 * read by quantityData.ts and articleData.ts (server). See docs/ORDER_PROCESS.md → Quantities, Article title.
 */
import { fmt } from '@/locales';
import type { DocumentFactRow, DocumentPlace, DocumentSide } from '@/types';

/** How one kind of fact is compared and worded */
export interface FactRules<V> {
    /** Whether a value found in a place matches the reference (the impegno's value) */
    equals: (value: V, reference: V, place: DocumentPlace<V>) => boolean;
    texts: {
        noImpegno: string;
        busMissing: string;
        netMissing: string;
        /** "{place}" = the differing place */
        busDiffers: string;
        netDiffers: string;
    };
}

export interface FactComparisonRow<K extends string, V> extends DocumentFactRow<K, V> {
    /** Places of the Business order whose value differs from the impegno ("attivit.at_qtapr") */
    busDiff: string[];
    /** The same for the NetPro order */
    netDiff: string[];
    issues: string[];
}

/** "table.column": the name of a place in the cells and in the issues */
export const placeName = (place: DocumentPlace<unknown>) => `${place.table}.${place.column}`;

/** A text cut to what a place keeps */
export const cutToPlace = (text: string, maxLength?: number) => (maxLength ? text.slice(0, maxLength) : text);

/** Whether a place holds a value other than the reference */
export const placeDiffers = <V>(place: DocumentPlace<V>, reference: V, rules: FactRules<V>) =>
    place.values.some((item) => !rules.equals(item.value, reference, place));

/** Impegno (truth) ↔ Business order ↔ NetPro order: where each fact differs, one issue per differing place */
export function compareFacts<K extends string, V>(rows: DocumentFactRow<K, V>[], rules: FactRules<V>): FactComparisonRow<K, V>[] {
    return rows.map((row) => {
        const result: FactComparisonRow<K, V> = { ...row, busDiff: [], netDiff: [], issues: [] };
        const reference = row.impegno?.value;
        if (reference === undefined) {
            result.issues.push(rules.texts.noImpegno);
            return result;
        }
        /** The differing places of one order; a missing order is an issue, an order without the fact is not */
        const check = (side: DocumentSide<V> | undefined, differsText: string, missingText: string): string[] => {
            if (!side) {
                result.issues.push(missingText);
                return [];
            }
            const differing = side.places.filter((place) => placeDiffers(place, reference, rules)).map(placeName);
            differing.forEach((place) => result.issues.push(fmt(differsText, { place })));
            return differing;
        };
        result.busDiff = check(row.bus, rules.texts.busDiffers, rules.texts.busMissing);
        result.netDiff = check(row.net, rules.texts.netDiffers, rules.texts.netMissing);
        return result;
    });
}

/** Number of facts with at least one difference (counted in the "Disallineato da DiBa" badge) */
export const countFactIssues = <K extends string, V>(rows: DocumentFactRow<K, V>[], rules: FactRules<V>) =>
    compareFacts(rows, rules).filter((row) => row.issues.length > 0).length;
