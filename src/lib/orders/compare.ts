/**
 * 3-way comparison DiBa (truth) ↔ Business production order ↔ NetPro order.
 * Shared by the server (discrepancy count) and the UI (comparison tables), so both always agree.
 * See docs/ORDER_PROCESS.md.
 */
import type {
    DibaOperationRow,
    BusinessOrderOperationRow,
    OrderProductionOperationRow,
    DibaMaterialRow,
    OrderMaterialSummaryRow,
} from '@/types';

export type OpField = 'lav' | 'centro' | 'note' | 'missing';

export interface OperationComparisonRow {
    fase: number;
    diba?: DibaOperationRow;
    bus?: BusinessOrderOperationRow;
    net?: OrderProductionOperationRow;
    /** Fields where the Business order differs from DiBa */
    busDiff: OpField[];
    /** Fields where the NetPro order differs from DiBa */
    netDiff: OpField[];
    issues: string[];
}

export interface MaterialComparisonRow {
    part_number: string;
    description: string;
    unmis: string;
    expected?: number;
    bus?: number;
    net?: number;
    busDiff: boolean;
    netDiff: boolean;
    issues: string[];
}

const txt = (v: unknown) => String(v ?? '').trim().toLowerCase();
/** Quantities are compared to the thousandth (materials, order quantities) */
export const QTY_EPS = 0.001;

/**
 * Placeholder material: keeps a production order's material list non-empty when it has no real materials (NetPro wants one).
 * Next to a real material it is useless: the comparison then shows it "da rimuovere" and Riallinea removes it everywhere
 * (never adding it). Hidden from the NetPro materials list.
 */
export const PLACEHOLDER_MATERIAL = 'MP_FITTIZIA';
export const isPlaceholderMaterial = (code?: string) => String(code ?? '').trim().toUpperCase() === PLACEHOLDER_MATERIAL;
/** NetPro keeps only the first 100 chars of the DiBa note (OPERAZIONI.DESCRIZIONE01) */
const NETPRO_NOTE_LEN = 100;

/**
 * Material quantity as Business/NetPro compute it from the DiBa:
 * ceil(orderQty / perpz) * quant  (verified on real orders, e.g. 1358 pz, perpz 10000, quant 1200 -> 1200)
 */
export const dibaMaterialQty = (orderQty: number, quant: number, perpz: number) =>
    Math.ceil(orderQty / (perpz || 1)) * quant;

export function compareOperations(
    diba: DibaOperationRow[],
    bus: BusinessOrderOperationRow[],
    net: OrderProductionOperationRow[],
): OperationComparisonRow[] {
    const map = new Map<number, OperationComparisonRow>();
    const row = (fase: number) => {
        if (!map.has(fase)) map.set(fase, { fase, busDiff: [], netDiff: [], issues: [] });
        return map.get(fase)!;
    };
    diba.forEach(o => { row(o.fase).diba = o; });
    bus.forEach(o => { row(o.fase).bus = o; });
    net.forEach(o => { row(o.sequenza).net = o; });

    for (const r of Array.from(map.values())) {
        const d = r.diba;
        if (!d) {
            if (r.bus) { r.busDiff.push('missing'); r.issues.push('Fase non più in DiBa (presente in Business)'); }
            if (r.net) { r.netDiff.push('missing'); r.issues.push('Fase non più in DiBa (presente in NetPro)'); }
            continue;
        }
        // Business order vs DiBa
        if (!r.bus) {
            r.busDiff.push('missing'); r.issues.push('Manca nell\'ordine Business');
        } else {
            if (Number(r.bus.codlavo) !== Number(d.codlavo)) { r.busDiff.push('lav'); r.issues.push('Lavorazione Business ≠ DiBa'); }
            if (Number(r.bus.codcent) !== Number(d.codcent)) { r.busDiff.push('centro'); r.issues.push('Centro Business ≠ DiBa'); }
            if (txt(r.bus.note) !== txt(d.note)) { r.busDiff.push('note'); r.issues.push('Nota Business ≠ DiBa'); }
        }
        // NetPro order vs DiBa
        if (!r.net) {
            r.netDiff.push('missing'); r.issues.push('Manca nell\'ordine NetPro');
        } else {
            if (txt(r.net.descrizione) !== txt(d.descr_lavor)) { r.netDiff.push('lav'); r.issues.push('Lavorazione NetPro ≠ DiBa'); }
            if (txt(r.net.centro_assegnato) !== txt(d.codcent)) { r.netDiff.push('centro'); r.issues.push('Centro NetPro ≠ DiBa'); }
            if (txt(r.net.note) !== txt(String(d.note ?? '').slice(0, NETPRO_NOTE_LEN))) { r.netDiff.push('note'); r.issues.push('Nota NetPro ≠ DiBa'); }
        }
    }
    return Array.from(map.values()).sort((a, b) => a.fase - b.fase);
}

export function compareMaterials(
    diba: DibaMaterialRow[],
    bus: OrderMaterialSummaryRow[],
    net: OrderMaterialSummaryRow[],
    orderQty: number,
): MaterialComparisonRow[] {
    const map = new Map<string, MaterialComparisonRow>();
    const row = (code: string, description: string, unmis: string) => {
        if (!map.has(code)) map.set(code, { part_number: code, description, unmis, busDiff: false, netDiff: false, issues: [] });
        return map.get(code)!;
    };
    // The placeholder is compared apart (below); the real materials are summed per code (an order could hold a code on more rows)
    const placeholder = {
        diba: diba.find(m => isPlaceholderMaterial(m.codfigli)),
        bus: bus.find(m => isPlaceholderMaterial(m.part_number)),
        net: net.find(m => isPlaceholderMaterial(m.part_number)),
    };
    diba = diba.filter(m => !isPlaceholderMaterial(m.codfigli));
    bus = bus.filter(m => !isPlaceholderMaterial(m.part_number));
    net = net.filter(m => !isPlaceholderMaterial(m.part_number));
    diba.forEach(m => { const r = row(m.codfigli, m.description, m.unmis); r.expected = (r.expected || 0) + dibaMaterialQty(orderQty, m.quant, m.perpz); });
    bus.forEach(m => { const r = row(m.part_number, m.description, m.unmis); r.bus = (r.bus || 0) + Number(m.quant); });
    net.forEach(m => { const r = row(m.part_number, m.description, m.unmis); r.net = (r.net || 0) + Number(m.quant); });

    for (const r of Array.from(map.values())) {
        if (r.expected === undefined) {
            if (r.bus !== undefined) { r.busDiff = true; r.issues.push('Non più in DiBa (presente in Business)'); }
            if (r.net !== undefined) { r.netDiff = true; r.issues.push('Non più in DiBa (presente in NetPro)'); }
            continue;
        }
        if (r.bus === undefined) { r.busDiff = true; r.issues.push('Manca nell\'ordine Business'); }
        else if (Math.abs(r.bus - r.expected) > QTY_EPS) { r.busDiff = true; r.issues.push('Q.tà Business ≠ DiBa'); }
        if (r.net === undefined) { r.netDiff = true; r.issues.push('Manca nell\'ordine NetPro'); }
        else if (Math.abs(r.net - r.expected) > QTY_EPS) { r.netDiff = true; r.issues.push('Q.tà NetPro ≠ DiBa'); }
    }
    // Once the DiBa has a real material the placeholder has to go, wherever it still is
    if (diba.length > 0 && (placeholder.diba || placeholder.bus || placeholder.net)) {
        const sample = placeholder.bus ?? placeholder.net;
        const where = [placeholder.diba && 'DiBa', placeholder.bus && 'Business', placeholder.net && 'NetPro'].filter(Boolean).join(', ');
        map.set(PLACEHOLDER_MATERIAL, {
            part_number: PLACEHOLDER_MATERIAL,
            description: sample?.description ?? placeholder.diba?.description ?? PLACEHOLDER_MATERIAL,
            unmis: sample?.unmis ?? placeholder.diba?.unmis ?? '',
            bus: placeholder.bus ? Number(placeholder.bus.quant) : undefined,
            net: placeholder.net ? Number(placeholder.net.quant) : undefined,
            busDiff: !!placeholder.bus,
            netDiff: !!placeholder.net,
            issues: [`Materiale fittizio da rimuovere (${where})`],
        });
    }
    return Array.from(map.values()).sort((a, b) =>
        (b.issues.length > 0 ? 1 : 0) - (a.issues.length > 0 ? 1 : 0) || a.part_number.localeCompare(b.part_number));
}

/** Number of phase/material rows with at least one difference */
export function countDiscrepancies(ops: OperationComparisonRow[], mats: MaterialComparisonRow[]) {
    return ops.filter(r => r.issues.length > 0).length + mats.filter(r => r.issues.length > 0).length;
}
