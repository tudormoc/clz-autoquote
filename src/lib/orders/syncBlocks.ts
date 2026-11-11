/**
 * What a Riallinea takes away from an order, what it leaves, and when it is refused (pure). A realign removes what is
 * no longer in the DiBa, but never something already used (owner, 2026-11-06: "sync the rest, give alert, keep the
 * phase in netpro, count it as aligned, and keep a mark or a note"):
 * - a phase somebody already worked on in NetPro stays on the order: removing it would leave its hours without an order;
 * - a material row already withdrawn stays on the order;
 * everything else is realigned, and what stays is told before (the confirm window) and after (the order page, the
 * list, the log). The comparison counts a row that stays as aligned (compare.ts).
 * Still refused, with nothing written: an order whose DiBa is not the one it is being worked by (syncBlocks) — the
 * internal orders the indirect hours are booked on.
 * sync.ts removes by the same two "leaving" rules; the comparison (management.ts) asks the same function as the
 * realign, so the list and the order page say what the server will do.
 */
import { APP_CONFIG } from '@/config/constants';
import { APP_COPY, fmt } from '@/locales';
import type { SyncKeeps } from '@/types';

const copy = APP_COPY.analytics.orderOperations;

/** A phase of the NetPro order */
export interface OrderPhaseFact {
    fase: number;
    /** Somebody already worked on it (phaseStarted) */
    started: boolean;
}

/** A line of the DiBa's materials (never the placeholder) */
export interface DibaMaterialLine {
    riga: number;
    code: string;
}

/** A material row of the Business order (never the placeholder) */
export interface OrderMaterialFact {
    /** Its row in the order (mo_riga; NetPro keeps the same number) */
    riga: number;
    /** The DiBa line it comes from (mo_disbasriga = md_riga) */
    dibaRiga: number;
    code: string;
    /** Already withdrawn: "evaso" in Business, or a picked / used quantity in NetPro */
    withdrawn: boolean;
}

/** The DiBa and the order of one edition, as far as removing goes */
export interface RemovalFacts {
    article: string;
    /** The fasi of the article's DiBa */
    dibaPhases: number[];
    orderPhases: OrderPhaseFact[];
    dibaMaterials: DibaMaterialLine[];
    orderMaterials: OrderMaterialFact[];
}

/** Nothing stays: everything that left the DiBa can be removed */
export const NO_KEEPS: SyncKeeps = { phases: [], materials: [] };

/**
 * A NetPro operation somebody already worked on: work is recorded on it, or it has left the state of an operation
 * nobody touched (an unknown or missing state counts as started: the safe side). Both signs are needed: NetPro writes
 * the work rows of a day at night, so work done today shows in the state only.
 */
export const phaseStarted = (state: string | null | undefined, hasWork: unknown) =>
    Boolean(Number(hasWork)) || String(state ?? '').trim() !== APP_CONFIG.ORDERS.UNSTARTED_OPERATION_STATE;

/** The phases of the order that are no longer in the DiBa: those a realign removes, and those it leaves (worked on) */
export function phasesLeaving<T extends OrderPhaseFact>(orderPhases: T[], dibaPhases: number[]): { removed: T[]; kept: T[] } {
    const inDiba = new Set(dibaPhases.map(Number));
    const leaving = orderPhases.filter((phase) => !inDiba.has(Number(phase.fase)));
    return { removed: leaving.filter((phase) => !phase.started), kept: leaving.filter((phase) => phase.started) };
}

/**
 * The material rows of the order with no place in the DiBa any more (their DiBa line is gone or holds another code, or
 * a later row of the order already stands for that line): those a realign removes, and those it leaves (withdrawn).
 */
export function materialRowsLeaving<T extends OrderMaterialFact>(orderMaterials: T[], dibaMaterials: DibaMaterialLine[]): { removed: T[]; kept: T[] } {
    const codeOfLine = new Map(dibaMaterials.map((line) => [Number(line.riga), line.code]));
    const lastOfLine = new Map(orderMaterials.map((row) => [Number(row.dibaRiga), row]));
    const leaving = orderMaterials.filter((row) => !(codeOfLine.get(Number(row.dibaRiga)) === row.code && lastOfLine.get(Number(row.dibaRiga)) === row));
    return { removed: leaving.filter((row) => !row.withdrawn), kept: leaving.filter((row) => row.withdrawn) };
}

/**
 * Why the edition cannot be realigned as it is, in words; empty when it can. Refused when the DiBa is not the one the
 * order is being worked by:
 * - the article has no phases in the DiBa while the order has (every phase would go);
 * - none of the order's phases is in the DiBa and somebody already worked on some: the worked ones would stay next to
 *   a whole new set of phases (the internal orders with a DiBa of their own, RESPFINISSAGGIO and 9995CAMPIONATURA).
 * An order whose phases were all replaced before anybody worked on it is realigned as usual.
 */
export function syncBlocks({ article, dibaPhases, orderPhases }: RemovalFacts): string[] {
    if (orderPhases.length === 0) return [];
    if (dibaPhases.length === 0) return [fmt(copy.syncNoDibaPhases, { article })];
    const { removed, kept } = phasesLeaving(orderPhases, dibaPhases);
    const noneShared = removed.length + kept.length === orderPhases.length;
    return noneShared && kept.length > 0 ? [fmt(copy.syncNoSharedPhase, { phases: kept.map((phase) => phase.fase).join(', ') })] : [];
}

/** What a realign of the edition leaves in place (nothing when it is refused: then nothing is touched at all) */
export function syncKeeps(facts: RemovalFacts): SyncKeeps {
    if (syncBlocks(facts).length > 0) return NO_KEEPS;
    return {
        phases: phasesLeaving(facts.orderPhases, facts.dibaPhases).kept.map((phase) => Number(phase.fase)),
        materials: materialRowsLeaving(facts.orderMaterials, facts.dibaMaterials).kept.map(({ riga, code }) => ({ riga: Number(riga), code })),
    };
}

export const keepsSomething = (keeps?: SyncKeeps) => !!keeps && (keeps.phases.length > 0 || keeps.materials.length > 0);

/** What stays, one sentence each (the confirm window, the order page, the list, the message after a realign) */
export function syncKeepLines(keeps: SyncKeeps = NO_KEEPS): string[] {
    return [
        ...keeps.phases.map((fase) => fmt(copy.syncKeepsPhase, { fase })),
        ...keeps.materials.map(({ code }) => fmt(copy.syncKeepsMaterial, { code })),
    ];
}

/** The same in a few words, for a badge or the log: "fase 100, materiale 002KAGR…" */
export function syncKeepNames(keeps: SyncKeeps = NO_KEEPS): string {
    return [
        ...keeps.phases.map((fase) => fmt(copy.syncKeptPhaseName, { fase })),
        ...keeps.materials.map(({ code }) => fmt(copy.syncKeptMaterialName, { code })),
    ].join(', ');
}

/** The reasons of a refusal as one text (a button's tooltip, the message of a refused realign) */
export const syncBlockText = (blocks: string[]) => blocks.join(' ');
