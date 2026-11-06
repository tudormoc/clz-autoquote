/**
 * What a Riallinea removes from an order, and when that stops it (pure). A realign takes away what is no longer in the
 * DiBa; it is refused, and writes nothing, when that would take away something already used (owner, 2026-11-06:
 * "make them refuse for now until we fix them definitively"):
 * - the article has no phases in the DiBa (the internal orders the indirect hours are booked on): every phase would go;
 * - a phase to remove was already worked on in NetPro: its hours would lose their order;
 * - a material row to remove was already withdrawn.
 * sync.ts deletes by the same two "to remove" rules, and asks through its transaction right before the first write;
 * the comparison (management.ts) asks too, so the list and the order page say it before the button is pressed.
 */
import { APP_CONFIG } from '@/config/constants';
import { APP_COPY, fmt } from '@/locales';

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

/**
 * A NetPro operation somebody already worked on: work is recorded on it, or it has left the state of an operation
 * nobody touched (an unknown or missing state counts as started: the safe side).
 */
export const phaseStarted = (state: string | null | undefined, hasWork: unknown) =>
    Boolean(Number(hasWork)) || String(state ?? '').trim() !== APP_CONFIG.ORDERS.UNSTARTED_OPERATION_STATE;

/** The phases of the order that are no longer in the DiBa */
export function phasesToRemove<T extends { fase: number }>(orderPhases: T[], dibaPhases: number[]): T[] {
    const inDiba = new Set(dibaPhases.map(Number));
    return orderPhases.filter((phase) => !inDiba.has(Number(phase.fase)));
}

/**
 * The material rows of the order with no place in the DiBa any more: their DiBa line is gone or holds another code,
 * or a later row of the order already stands for that line.
 */
export function materialRowsToRemove<T extends { dibaRiga: number; code: string }>(orderMaterials: T[], dibaMaterials: DibaMaterialLine[]): T[] {
    const codeOfLine = new Map(dibaMaterials.map((line) => [Number(line.riga), line.code]));
    const lastOfLine = new Map(orderMaterials.map((row) => [Number(row.dibaRiga), row]));
    return orderMaterials.filter((row) => !(codeOfLine.get(Number(row.dibaRiga)) === row.code && lastOfLine.get(Number(row.dibaRiga)) === row));
}

const listed = (values: (string | number)[]) => Array.from(new Set(values)).join(', ');

/** The reasons of a refusal as one text (a button's tooltip, the message of a refused realign) */
export const syncBlockText = (blocks: string[]) => blocks.join(' ');

/** Why the edition cannot be realigned as it is, in words; empty when it can */
export function syncBlocks({ article, dibaPhases, orderPhases, dibaMaterials, orderMaterials }: RemovalFacts): string[] {
    const blocks: string[] = [];
    if (dibaPhases.length === 0 && orderPhases.length > 0) {
        blocks.push(fmt(copy.syncNoDibaPhases, { article }));
    } else {
        const started = phasesToRemove(orderPhases, dibaPhases).filter((phase) => phase.started);
        if (started.length > 0) blocks.push(fmt(copy.syncPhaseStarted, { phases: listed(started.map((phase) => phase.fase)) }));
    }
    const withdrawn = materialRowsToRemove(orderMaterials, dibaMaterials).filter((row) => row.withdrawn);
    if (withdrawn.length > 0) blocks.push(fmt(copy.syncMaterialWithdrawn, { materials: listed(withdrawn.map((row) => row.code)) }));
    return blocks;
}
