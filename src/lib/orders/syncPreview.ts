/**
 * What Riallinea is about to change, as lines a person can read, taken from the four comparisons the tabs show (quantities,
 * article data, phases, materials): the confirm window lists them before anything is written. Pure. The realign also
 * refreshes the phases' times and chain from the DiBa, which the comparisons do not model (docs/ORDER_PROCESS.md).
 */
import { ARTICLE_RULES, titleText } from '@/lib/orders/article';
import { NETPRO_NOTE_LEN, PLACEHOLDER_MATERIAL, type MaterialComparisonRow, type OperationComparisonRow } from '@/lib/orders/compare';
import { cutToPlace, placeName, type FactComparisonRow, type FactRules } from '@/lib/orders/documentFacts';
import { QUANTITY_RULES, quantityText } from '@/lib/orders/quantities';
import { APP_COPY, fmt } from '@/locales';
import type { ArticleKey, QuantityKey } from '@/types';

const t = APP_COPY.analytics.orderOperations;
const copy = t.syncPreview;

export type SyncChangeGroupKey = keyof typeof copy.groups;

/** The changes of one kind (quantities, article data, phases, materials), one line each */
export interface SyncChangeGroup {
    key: SyncChangeGroupKey;
    changes: string[];
}

export interface SyncPreviewInput {
    quantities: FactComparisonRow<QuantityKey, number>[];
    article: FactComparisonRow<ArticleKey, string>[];
    phases: OperationComparisonRow[];
    materials: MaterialComparisonRow[];
}

const text = (value: unknown) => String(value ?? '').trim() || copy.empty;
/** "Business, NetPro": the programs a change concerns */
const places = (bus: boolean, net: boolean, diba = false) =>
    [diba && copy.where.diba, bus && copy.where.bus, net && copy.where.net].filter(Boolean).join(', ');

/** A fact of the impegno: every place that holds another value gets the impegno's (cut to what the place keeps) */
function factChanges<K extends string, V>(
    rows: FactComparisonRow<K, V>[],
    rules: FactRules<V>,
    names: Record<K, string>,
    format: (value: V) => string,
    target: (reference: V, maxLength?: number) => V
): string[] {
    const lines: string[] = [];
    for (const row of rows) {
        const reference = row.impegno?.value;
        if (reference === undefined) continue;
        for (const side of [row.impegno, row.bus, row.net]) {
            for (const place of side?.places ?? []) {
                const differing = place.values.filter((item) => !rules.equals(item.value, reference, place));
                if (differing.length === 0) continue;
                const from = differing.map((item) => `${format(item.value)}${item.rows > 1 ? ` ${fmt(t.factRows, { n: item.rows })}` : ''}`).join(', ');
                lines.push(fmt(copy.fact, { fact: names[row.key], place: placeName(place), from, to: format(target(reference, place.maxLength)) }));
            }
        }
    }
    return lines;
}

/** Phases: added where the DiBa has one the order lacks, removed where the DiBa has none, else the fields taken again from the DiBa */
function phaseChanges(rows: OperationComparisonRow[]): string[] {
    const lines: string[] = [];
    for (const { fase, diba, bus, net, busDiff, netDiff } of rows) {
        if (!diba) {
            if (bus || net) lines.push(fmt(copy.phaseRemove, { fase, where: places(!!bus, !!net) }));
            continue;
        }
        if (!bus || !net) lines.push(fmt(copy.phaseAdd, { fase, where: places(!bus, !net), name: text(diba.descr_lavor), centro: diba.codcent }));
        const field = (where: string, name: keyof typeof copy.phaseFields, from: unknown, to: unknown) =>
            lines.push(fmt(copy.phaseField, { fase, where, field: copy.phaseFields[name], from: text(from), to: text(to) }));
        if (bus) {
            if (busDiff.includes('lav')) field(copy.where.bus, 'lav', bus.descr_lavor, diba.descr_lavor);
            if (busDiff.includes('centro')) field(copy.where.bus, 'centro', bus.codcent, diba.codcent);
            if (busDiff.includes('note')) field(copy.where.bus, 'note', bus.note, diba.note);
        }
        if (net) {
            if (netDiff.includes('lav')) field(copy.where.net, 'lav', net.descrizione, diba.descr_lavor);
            if (netDiff.includes('centro')) field(copy.where.net, 'centro', net.centro_assegnato, diba.codcent);
            if (netDiff.includes('note')) field(copy.where.net, 'note', net.note, String(diba.note ?? '').slice(0, NETPRO_NOTE_LEN));
        }
    }
    return lines;
}

/** Materials: removed when the DiBa has none (or it is the placeholder), added where missing, else the DiBa's quantity */
function materialChanges(rows: MaterialComparisonRow[]): string[] {
    const lines: string[] = [];
    for (const row of rows) {
        const code = row.part_number;
        const inBus = row.bus !== undefined;
        const inNet = row.net !== undefined;
        if (code === PLACEHOLDER_MATERIAL || row.expected === undefined) {
            if (inBus || inNet || row.placeholderInDiba) lines.push(fmt(copy.materialRemove, { code, where: places(inBus, inNet, !!row.placeholderInDiba) }));
            continue;
        }
        const to = quantityText(row.expected);
        if (!inBus || !inNet) lines.push(fmt(copy.materialAdd, { code, where: places(!inBus, !inNet), qty: to }));
        if (inBus && row.busDiff) lines.push(fmt(copy.materialQty, { code, where: copy.where.bus, from: quantityText(row.bus ?? 0), to }));
        if (inNet && row.netDiff) lines.push(fmt(copy.materialQty, { code, where: copy.where.net, from: quantityText(row.net ?? 0), to }));
    }
    return lines;
}

/** The groups that have something to change, in the order Riallinea works: quantities, article data, phases, materials */
export function previewSync({ quantities, article, phases, materials }: SyncPreviewInput): SyncChangeGroup[] {
    const groups: SyncChangeGroup[] = [
        { key: 'quantity', changes: factChanges(quantities, QUANTITY_RULES, t.quantityNames, quantityText, (reference) => reference) },
        { key: 'article', changes: factChanges(article, ARTICLE_RULES, t.articleNames, titleText, cutToPlace) },
        { key: 'phases', changes: phaseChanges(phases) },
        { key: 'materials', changes: materialChanges(materials) },
    ];
    return groups.filter((group) => group.changes.length > 0);
}
