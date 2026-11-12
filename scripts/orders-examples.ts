/**
 * Regression check for the order rules of Avanzamento Lavori (src/lib/orders, docs/ORDER_PROCESS.md), on made-up
 * orders: the comparison of an order with its DiBa (phases, materials, quantities, article data), what a Riallinea
 * would change, what it leaves on the order because it was already used, when it is refused, the rows it writes for a
 * new phase, and the production flow. No database: these are the pure rules the server and the screens share.
 *
 *   npm run orders:examples
 */
import { APP_CONFIG } from '@/config/constants';
import { calcExpectedHours } from '@/lib/expectedHours';
import { sumOrderHours, type OrderAreaHoursRow } from '@/lib/orderAreaHours';
import { ARTICLE_RULES, measureText, titleText } from '@/lib/orders/article';
import { NETPRO_NOTE_LEN, PLACEHOLDER_MATERIAL, compareMaterials, compareOperations, dibaMaterialQty, isPlaceholderMaterial } from '@/lib/orders/compare';
import { compareFacts, cutToPlace, placeName } from '@/lib/orders/documentFacts';
import { compareOrder, countDifferences, differenceLines, orderDifferences } from '@/lib/orders/differences';
import { buildProductionFlow, type FlowOperation, type FlowStatus } from '@/lib/orders/flow';
import { QUANTITY_RULES, quantityText } from '@/lib/orders/quantities';
import { NO_KEEPS, keepsSomething, materialRowsLeaving, phaseStarted, phasesLeaving, syncBlocks, syncKeepLines, syncKeepNames, syncKeeps, type RemovalFacts } from '@/lib/orders/syncBlocks';
import { previewSync, type SyncPreviewInput } from '@/lib/orders/syncPreview';
import { NOW, buildBusinessOverrides, buildNetProOverrides, netOperId, type SyncDibaOp } from '@/lib/orders/syncRows';
import { APP_COPY, fmt } from '@/locales';
import type {
    BusinessOrderOperationRow,
    DibaMaterialRow,
    DibaOperationRow,
    DocumentPlace,
    OrderArticleRow,
    OrderMaterialSummaryRow,
    OrderOperationsManagementData,
    OrderProductionOperationRow,
    OrderQuantityRow,
} from '@/types';

const t = APP_COPY.analytics.orderOperations;
const preview = t.syncPreview;
const UNSTARTED = APP_CONFIG.ORDERS.UNSTARTED_OPERATION_STATE;

// ── A made-up order: phases 10, 20, 30; the same phase in the DiBa, the Business order and the NetPro order ────────
const dibaPhase = (fase: number, change: Partial<DibaOperationRow> = {}): DibaOperationRow => ({
    riga: fase, fase, codlavo: 100 + fase, descr_lavor: `LAVORAZIONE ${fase}`, terzista: 'N', codcent: 500 + fase, descr_centro: `CENTRO ${fase}`,
    note: '', tesec: 60, perqta: 1, aggriga: '', ...change,
});
const busPhase = (fase: number, change: Partial<BusinessOrderOperationRow> = {}): BusinessOrderOperationRow => ({
    fase, codlavo: 100 + fase, descr_lavor: `LAVORAZIONE ${fase}`, codcent: 500 + fase, descr_centro: `CENTRO ${fase}`, note: '', ...change,
});
const netPhase = (fase: number, change: Partial<OrderProductionOperationRow> = {}): OrderProductionOperationRow => ({
    id_oper: `H26 X${fase}`, ordine: 'H26 X', sequenza: fase, descrizione: `LAVORAZIONE ${fase}`, stato: UNSTARTED, centro_assegnato: String(500 + fase),
    machine_code: '', machine_name: '', area_name: '', note: '', ...change,
});
const FASI = [10, 20, 30];
/** What the comparison says of each phase: "10 ok", "20 bus:missing net:lav,note", "30 kept" */
const phaseSummary = (rows: ReturnType<typeof compareOperations>) =>
    rows.map((row) => `${row.fase} ${row.kept ? 'kept' : [row.busDiff.length > 0 && `bus:${row.busDiff.join(',')}`, row.netDiff.length > 0 && `net:${row.netDiff.join(',')}`].filter(Boolean).join(' ') || 'ok'}`);
const LONG_NOTE = 'N'.repeat(NETPRO_NOTE_LEN + 50);

// ── Materials: the DiBa line, the row of the Business order and of the NetPro order ────────────────────────────────
const QTY = 1500;
const dibaMaterial = (code: string, quant: number, riga = 1): DibaMaterialRow => ({ riga, codfigli: code, description: `MATERIALE ${code}`, quant, perpz: 1000, unmis: 'KG' });
const orderMaterial = (code: string, quant: number, riga?: number): OrderMaterialSummaryRow => ({ riga, part_number: code, description: `MATERIALE ${code}`, quant, unmis: 'KG' });
/** "CARTA exp 12 bus 12 net 10 [net]": a material with what is expected, what each order holds and where it differs */
const materialSummary = (rows: ReturnType<typeof compareMaterials>) =>
    rows.map((row) => {
        const parts = [row.part_number, row.expected !== undefined && `exp ${row.expected}`, row.bus !== undefined && `bus ${row.bus}`, row.net !== undefined && `net ${row.net}`];
        const differs = [row.busDiff && 'bus', row.netDiff && 'net'].filter(Boolean).join(',');
        const kept = row.kept ? `kept ${JSON.stringify(row.kept)}` : false;
        return [...parts, differs && `[${differs}]`, kept].filter(Boolean).join(' ');
    });

// ── Facts of the impegno cliente (quantities, article data) in the places of the two orders ────────────────────────
const place = <V>(table: string, column: string, values: [V, number][], maxLength?: number): DocumentPlace<V> => ({ table, column, values: values.map(([value, rows]) => ({ value, rows })), maxLength });
const quantityRow = (impegno: number | undefined, bus: [number, number][] | null, net: [number, number][] | null): OrderQuantityRow => ({
    key: 'ordered',
    impegno: impegno === undefined ? undefined : { value: impegno, places: [] },
    bus: bus === null ? undefined : { value: bus[0]?.[0], places: [place('attivit', 'at_qtapr', bus)] },
    net: net === null ? undefined : { value: net[0]?.[0], places: [place('OPERAZIONI', 'QTA_RICHIESTA', net)] },
});
const TITLE = 'Il grande libro delle prove di rilegatura';
const titleRow = (bus: string, net: string, netLength = 10): OrderArticleRow => ({
    key: 'name',
    impegno: { value: TITLE, places: [] },
    bus: { value: bus, places: [place('movord', 'mo_descr', [[bus, 1]], 255)] },
    net: { value: net, places: [place('ORDINI', 'DESCRIZIONE', [[net, 1]], netLength)] },
});

// ── What a realign may remove ──────────────────────────────────────────────────────────────────────────────────────
const removal = (change: Partial<RemovalFacts> = {}): RemovalFacts => ({
    article: 'ART1', dibaPhases: [10, 20], orderPhases: [{ fase: 10, started: false }, { fase: 20, started: false }], dibaMaterials: [], orderMaterials: [], ...change,
});
const fasi = (phases: { fase: number }[]) => phases.map((phase) => phase.fase);
const righe = (rows: { riga: number }[]) => rows.map((row) => row.riga);

// ── The four comparisons of a made-up edition, as the tabs show them ───────────────────────────────────────────────
const comparisons = (change: Partial<SyncPreviewInput> = {}): SyncPreviewInput => ({ quantities: [], article: [], phases: [], materials: [], ...change });
const groupsOf = (input: SyncPreviewInput) => previewSync(input).map((group) => ({ [group.key]: group.changes }));
const managementData = (change: Partial<OrderOperationsManagementData> = {}): OrderOperationsManagementData => ({
    article_father: 'ART1', ordine_netpro: 'H26 X', order_father_quant: QTY,
    diba_operations: FASI.map((fase) => dibaPhase(fase)), order_operations: FASI.map((fase) => netPhase(fase)), business_operations: FASI.map((fase) => busPhase(fase)),
    diba_materials: [dibaMaterial('CARTA', 12)], order_materials: [orderMaterial('CARTA', 12)], netpro_materials: [orderMaterial('CARTA', 12)],
    ...change,
});

// ── The production flow ────────────────────────────────────────────────────────────────────────────────────────────
const flowStep = (area_name: string, status: FlowStatus): FlowOperation => ({ machine_code: '1', machine_name: 'M', operation_name: area_name, area_name, status, edition_count: 1 });
const statuses = (steps: FlowOperation[]) => steps.map((step) => `${step.area_name}:${step.status}`);

const NEW_PHASE: SyncDibaOp = { riga: 4, fase: 5, codlavo: 105, descr_lavor: 'PIEGA', terzista: '', codcent: 505, note: 'N'.repeat(130), tesec: 90 };

// ── Report Ordini per Area: the hours of an order (the one sum of the screen summary and of the PDF) ────────────────
const { AREA_EXPECTED_VELOCITY, FOLDING_AREA } = APP_CONFIG.ANALYTICS;
/** An area with an expected speed measured in copies, and one the settings give no speed for */
const AREA_WITH_SPEED = Object.entries(AREA_EXPECTED_VELOCITY).find(([area, speed]) => speed > 0 && area !== FOLDING_AREA)![0];
const AREA_WITHOUT_SPEED = 'AREA SENZA VELOCITA';
const areaRow = (commessa: string, area: string, work_time: number, change: Partial<OrderAreaHoursRow> = {}): OrderAreaHoursRow => ({
    commessa_display: commessa, order_description: `Ordine ${commessa}`, client_name: 'CLIENTE', area_name: area, work_time, qty_requested: 3000, fogli: 500, ...change,
});
const expectedOf = (area: string, qty: number | null = 3000, fogli: number | null = 500) => calcExpectedHours(area, qty, fogli);
/** "9001 worked 7 expected 2.5 | AREA 5/2.5, ALTRA 2/-" */
const hoursSummary = (orders: ReturnType<typeof sumOrderHours>) =>
    orders.map((order) => `${order.display} worked ${order.worked} expected ${order.expected} | ${order.areas.map((area) => `${area.label} ${area.worked}/${area.expected ?? '-'}`).join(', ')}`);

const EXAMPLES: { name: string; expected: unknown; actual: () => unknown }[] = [
    // Phases: DiBa (the truth) ↔ Business order ↔ NetPro order
    { name: 'phases: an order equal to its DiBa has nothing to say', expected: ['10 ok', '20 ok', '30 ok'], actual: () => phaseSummary(compareOperations(FASI.map((f) => dibaPhase(f)), FASI.map((f) => busPhase(f)), FASI.map((f) => netPhase(f)))) },
    { name: 'phases: one missing in the Business order, one in the NetPro order', expected: ['10 bus:missing', '20 net:missing', '30 ok'], actual: () => phaseSummary(compareOperations(FASI.map((f) => dibaPhase(f)), [busPhase(20), busPhase(30)], [netPhase(10), netPhase(30)])) },
    { name: 'phases: one no longer in the DiBa, still on both orders', expected: ['10 ok', '20 bus:missing net:missing'], actual: () => phaseSummary(compareOperations([dibaPhase(10)], [busPhase(10), busPhase(20)], [netPhase(10), netPhase(20)])) },
    { name: 'phases: no longer in the DiBa but already worked on: it stays, and is no difference', expected: [['10 ok', '20 kept'], 0], actual: () => { const rows = compareOperations([dibaPhase(10)], [busPhase(10), busPhase(20)], [netPhase(10), netPhase(20)], [20]); return [phaseSummary(rows), rows.filter((row) => row.issues.length > 0).length]; } },
    { name: 'phases: another lavorazione, another centro, another note', expected: ['10 bus:lav net:lav', '20 bus:centro net:centro', '30 bus:note net:note'], actual: () => phaseSummary(compareOperations(FASI.map((f) => dibaPhase(f, { note: f === 30 ? 'urgente' : '' })), [busPhase(10, { codlavo: 999 }), busPhase(20, { codcent: 999 }), busPhase(30, { note: 'con calma' })], [netPhase(10, { descrizione: 'ALTRA' }), netPhase(20, { centro_assegnato: '999' }), netPhase(30, { note: '' })])) },
    { name: 'phases: texts are compared without capitals and spaces around', expected: ['10 ok'], actual: () => phaseSummary(compareOperations([dibaPhase(10, { note: 'Urgente ' })], [busPhase(10, { note: ' URGENTE' })], [netPhase(10, { note: 'urgente', descrizione: ' lavorazione 10 ' })])) },
    { name: `phases: NetPro keeps the first ${NETPRO_NOTE_LEN} characters of a note: that much is aligned, the whole note is not`, expected: [['10 ok'], ['10 net:note']], actual: () => [phaseSummary(compareOperations([dibaPhase(10, { note: LONG_NOTE })], [busPhase(10, { note: LONG_NOTE })], [netPhase(10, { note: LONG_NOTE.slice(0, NETPRO_NOTE_LEN) })])), phaseSummary(compareOperations([dibaPhase(10, { note: LONG_NOTE })], [busPhase(10, { note: LONG_NOTE })], [netPhase(10, { note: LONG_NOTE })]))] },
    { name: 'phases: the note NetPro keeps is 100 characters, and a new phase is written with exactly that much', expected: [100, 100], actual: () => [NETPRO_NOTE_LEN, String(buildNetProOverrides({ ...NEW_PHASE, note: LONG_NOTE }, 'H26 X', QTY, NOW).OPERAZIONI.DESCRIZIONE01).length] },
    { name: 'phases: listed by phase number, whatever the order they were read in', expected: [10, 20, 30], actual: () => compareOperations([dibaPhase(30), dibaPhase(10)], [busPhase(20)], []).map((row) => row.fase) },

    // Materials
    { name: 'materials: the quantity Business and NetPro compute from the DiBa (pieces, quantity, per pieces)', expected: [1200, 5, 15, 7500], actual: () => [dibaMaterialQty(1358, 1200, 10000), dibaMaterialQty(1000, 5, 1000), dibaMaterialQty(2500, 5, 1000), dibaMaterialQty(1500, 5, 0)] },
    { name: 'materials: the same quantity everywhere', expected: ['CARTA exp 12 bus 12 net 12'], actual: () => materialSummary(compareMaterials([dibaMaterial('CARTA', 12)], [orderMaterial('CARTA', 12)], [orderMaterial('CARTA', 12)], QTY)) },
    { name: 'materials: another quantity on the NetPro order', expected: ['CARTA exp 12 bus 12 net 10 [net]'], actual: () => materialSummary(compareMaterials([dibaMaterial('CARTA', 12)], [orderMaterial('CARTA', 12)], [orderMaterial('CARTA', 10)], QTY)) },
    { name: 'materials: less than a thousandth apart is the same quantity', expected: ['CARTA exp 12 bus 12.0005 net 11.9995'], actual: () => materialSummary(compareMaterials([dibaMaterial('CARTA', 12)], [orderMaterial('CARTA', 12.0005)], [orderMaterial('CARTA', 11.9995)], QTY)) },
    { name: 'materials: missing on the Business order', expected: [['CARTA exp 12 net 12 [bus]'], ["Manca nell'ordine Business"]], actual: () => { const rows = compareMaterials([dibaMaterial('CARTA', 12)], [], [orderMaterial('CARTA', 12)], QTY); return [materialSummary(rows), rows[0].issues]; } },
    { name: 'materials: no longer in the DiBa, still on both orders', expected: ['COLLA bus 3 net 3 [bus,net]', 'CARTA exp 12 bus 12 net 12'], actual: () => materialSummary(compareMaterials([dibaMaterial('CARTA', 12)], [orderMaterial('CARTA', 12), orderMaterial('COLLA', 3)], [orderMaterial('CARTA', 12), orderMaterial('COLLA', 3)], QTY)) },
    { name: 'materials: a code on two rows of an order is summed', expected: ['CARTA exp 12 bus 12 net 12'], actual: () => materialSummary(compareMaterials([dibaMaterial('CARTA', 12)], [orderMaterial('CARTA', 5), orderMaterial('CARTA', 7)], [orderMaterial('CARTA', 12)], QTY)) },
    { name: 'materials: a row no longer in the DiBa but already withdrawn stays, and is no difference', expected: [['CARTA exp 12 bus 12 net 12', 'COLLA kept {"bus":3,"net":3}'], 0], actual: () => { const rows = compareMaterials([dibaMaterial('CARTA', 12)], [orderMaterial('CARTA', 12, 1), orderMaterial('COLLA', 3, 2)], [orderMaterial('CARTA', 12, 1), orderMaterial('COLLA', 3, 2)], QTY, [2]); return [materialSummary(rows), rows.filter((row) => row.issues.length > 0).length]; } },
    { name: 'materials: the placeholder alone (an order without real materials) is no difference', expected: [], actual: () => materialSummary(compareMaterials([dibaMaterial(PLACEHOLDER_MATERIAL, 1)], [orderMaterial(PLACEHOLDER_MATERIAL, 1)], [orderMaterial(PLACEHOLDER_MATERIAL, 1)], QTY)) },
    { name: 'materials: next to a real material the placeholder is to be removed, wherever it still is', expected: [[`${PLACEHOLDER_MATERIAL} bus 1 net 1 [bus,net]`, 'CARTA exp 12 bus 12 net 12'], ['Materiale fittizio da rimuovere (DiBa, Business, NetPro)']], actual: () => { const rows = compareMaterials([dibaMaterial('CARTA', 12), dibaMaterial(PLACEHOLDER_MATERIAL, 1, 2)], [orderMaterial('CARTA', 12), orderMaterial(PLACEHOLDER_MATERIAL, 1)], [orderMaterial('CARTA', 12), orderMaterial(PLACEHOLDER_MATERIAL, 1)], QTY); return [materialSummary(rows), rows[0].issues]; } },
    { name: 'materials: the placeholder is recognised whatever the capitals and spaces', expected: [true, true, false, false], actual: () => [' mp_fittizia ', PLACEHOLDER_MATERIAL, 'CARTA', undefined].map(isPlaceholderMaterial) },

    // What a realign removes, leaves, and when it is refused
    { name: 'started: work recorded, or any state but the one of a phase nobody touched (unknown = started, the safe side)', expected: [false, false, true, true, true, true], actual: () => [phaseStarted(UNSTARTED, 0), phaseStarted(` ${UNSTARTED} `, '0'), phaseStarted(UNSTARTED, 1), phaseStarted('EXE', 0), phaseStarted(null, 0), phaseStarted('', 0)] },
    { name: 'leaving phases: the ones not in the DiBa; removed when untouched, left when worked on', expected: { removed: [30], kept: [20] }, actual: () => { const { removed, kept } = phasesLeaving([{ fase: 10, started: true }, { fase: 20, started: true }, { fase: 30, started: false }], [10]); return { removed: fasi(removed), kept: fasi(kept) }; } },
    { name: 'leaving materials: a row whose DiBa line holds another code now; left when already withdrawn', expected: { removed: [], kept: [2] }, actual: () => { const { removed, kept } = materialRowsLeaving([{ riga: 1, dibaRiga: 1, code: 'CARTA', withdrawn: false }, { riga: 2, dibaRiga: 2, code: 'COLLA', withdrawn: true }, { riga: 3, dibaRiga: 2, code: 'FILO', withdrawn: false }], [{ riga: 1, code: 'CARTA' }, { riga: 2, code: 'FILO' }]); return { removed: righe(removed), kept: righe(kept) }; } },
    { name: 'leaving materials: two rows for one DiBa line, the later one stands for it and the earlier one goes', expected: { removed: [1], kept: [] }, actual: () => { const { removed, kept } = materialRowsLeaving([{ riga: 1, dibaRiga: 1, code: 'CARTA', withdrawn: false }, { riga: 2, dibaRiga: 1, code: 'CARTA', withdrawn: false }], [{ riga: 1, code: 'CARTA' }]); return { removed: righe(removed), kept: righe(kept) }; } },
    { name: 'leaving materials: a row whose DiBa line is gone', expected: { removed: [2], kept: [] }, actual: () => { const { removed, kept } = materialRowsLeaving([{ riga: 1, dibaRiga: 1, code: 'CARTA', withdrawn: false }, { riga: 2, dibaRiga: 9, code: 'COLLA', withdrawn: false }], [{ riga: 1, code: 'CARTA' }]); return { removed: righe(removed), kept: righe(kept) }; } },
    { name: 'refused: nothing when the order and the DiBa share their phases, or the order has none yet', expected: [[], []], actual: () => [syncBlocks(removal()), syncBlocks(removal({ orderPhases: [] }))] },
    { name: 'refused: the article has no phases in the DiBa while the order has (every phase would go)', expected: [fmt(t.syncNoDibaPhases, { article: 'ART1' })], actual: () => syncBlocks(removal({ dibaPhases: [] })) },
    { name: 'refused: no phase of the order is in the DiBa and some were worked on (an order worked by another DiBa)', expected: [fmt(t.syncNoSharedPhase, { phases: '10, 20' })], actual: () => syncBlocks(removal({ dibaPhases: [70, 80], orderPhases: [{ fase: 10, started: true }, { fase: 20, started: true }, { fase: 30, started: false }] })) },
    { name: 'not refused: every phase replaced before anybody worked on the order', expected: [], actual: () => syncBlocks(removal({ dibaPhases: [70, 80] })) },
    { name: 'not refused: a worked phase left the DiBa while others are shared: it stays', expected: [[], { phases: [20], materials: [] }], actual: () => { const facts = removal({ dibaPhases: [10], orderPhases: [{ fase: 10, started: false }, { fase: 20, started: true }] }); return [syncBlocks(facts), syncKeeps(facts)]; } },
    { name: 'what stays: the worked phases and the withdrawn materials that left the DiBa', expected: { phases: [20], materials: [{ riga: 2, code: 'COLLA' }] }, actual: () => syncKeeps(removal({ dibaPhases: [10], orderPhases: [{ fase: 10, started: false }, { fase: 20, started: true }], dibaMaterials: [{ riga: 1, code: 'CARTA' }], orderMaterials: [{ riga: 1, dibaRiga: 1, code: 'CARTA', withdrawn: false }, { riga: 2, dibaRiga: 2, code: 'COLLA', withdrawn: true }] })) },
    { name: 'what stays: nothing when the realign is refused (then nothing is touched at all)', expected: NO_KEEPS, actual: () => syncKeeps(removal({ dibaPhases: [], orderPhases: [{ fase: 10, started: true }] })) },
    { name: 'what stays, in words: one sentence each, and a few words for the badge', expected: [[fmt(t.syncKeepsPhase, { fase: 20 }), fmt(t.syncKeepsMaterial, { code: 'COLLA' })], 'fase 20, materiale COLLA', true, false, false], actual: () => { const keeps = { phases: [20], materials: [{ riga: 2, code: 'COLLA' }] }; return [syncKeepLines(keeps), syncKeepNames(keeps), keepsSomething(keeps), keepsSomething(NO_KEEPS), keepsSomething(undefined)]; } },

    // Quantities and article data: the impegno cliente (the truth) ↔ the places of the two orders
    { name: 'quantity: the same in every place', expected: [[], [], []], actual: () => { const [row] = compareFacts([quantityRow(1500, [[1500, 3]], [[1500, 3]])], QUANTITY_RULES); return [row.busDiff, row.netDiff, row.issues]; } },
    { name: 'quantity: another value in a place of the NetPro order', expected: [[], ['OPERAZIONI.QTA_RICHIESTA'], [fmt(t.quantityNetDiffers, { place: 'OPERAZIONI.QTA_RICHIESTA' })]], actual: () => { const [row] = compareFacts([quantityRow(1500, [[1500, 3]], [[1500, 2], [1000, 1]])], QUANTITY_RULES); return [row.busDiff, row.netDiff, row.issues]; } },
    { name: 'quantity: no impegno cliente, an order that is not there', expected: [[t.factNoImpegno], [t.factBusMissing], [t.factNetMissing]], actual: () => [compareFacts([quantityRow(undefined, [[1500, 1]], [[1500, 1]])], QUANTITY_RULES)[0].issues, compareFacts([quantityRow(1500, null, [[1500, 1]])], QUANTITY_RULES)[0].issues, compareFacts([quantityRow(1500, [[1500, 1]], null)], QUANTITY_RULES)[0].issues] },
    { name: 'quantity: compared to the thousandth', expected: [true, false], actual: () => [1500.0009, 1500.002].map((value) => QUANTITY_RULES.equals(value, 1500, place('x', 'y', []))) },
    { name: 'title: without capitals and spaces around; a place that keeps 10 characters matches the first 10', expected: [[], []], actual: () => { const [row] = compareFacts([titleRow(` ${TITLE.toUpperCase()} `, TITLE.slice(0, 10))], ARTICLE_RULES); return [row.busDiff, row.netDiff]; } },
    { name: 'title: another text in the Business order, the whole title where NetPro keeps 10 characters', expected: [['movord.mo_descr'], ['ORDINI.DESCRIZIONE']], actual: () => { const [row] = compareFacts([titleRow('Altro titolo', TITLE)], ARTICLE_RULES); return [row.busDiff, row.netDiff]; } },
    { name: 'a place by name; a text cut to what a place keeps; an empty title; a measure as text', expected: ['movord.mo_descr', 'Il grande ', TITLE, titleText(''), measureText('210')], actual: () => [placeName(place('movord', 'mo_descr', [])), cutToPlace(TITLE, 10), cutToPlace(TITLE), titleText(''), measureText(210)] },

    // What Riallinea would change: the lines of its confirm window
    { name: 'preview: nothing to change, no group', expected: [], actual: () => groupsOf(comparisons({ phases: compareOperations(FASI.map((f) => dibaPhase(f)), FASI.map((f) => busPhase(f)), FASI.map((f) => netPhase(f))) })) },
    { name: 'preview: a phase to add to NetPro, one to remove from both, a centro to take again from the DiBa', expected: [{ phases: [fmt(preview.phaseField, { fase: 10, where: preview.where.bus, field: preview.phaseFields.centro, from: 999, to: 510 }), fmt(preview.phaseAdd, { fase: 20, where: preview.where.net, name: 'LAVORAZIONE 20', centro: 520 }), fmt(preview.phaseRemove, { fase: 30, where: `${preview.where.bus}, ${preview.where.net}` })] }], actual: () => groupsOf(comparisons({ phases: compareOperations([dibaPhase(10), dibaPhase(20)], [busPhase(10, { codcent: 999 }), busPhase(20), busPhase(30)], [netPhase(10), netPhase(30)]) })) },
    { name: 'preview: a worked phase that left the DiBa is not in the list', expected: [], actual: () => groupsOf(comparisons({ phases: compareOperations([dibaPhase(10)], [busPhase(10), busPhase(20)], [netPhase(10), netPhase(20)], [20]) })) },
    { name: 'preview: an empty note is written as such', expected: [{ phases: [fmt(preview.phaseField, { fase: 10, where: preview.where.net, field: preview.phaseFields.note, from: preview.empty, to: 'urgente' })] }], actual: () => groupsOf(comparisons({ phases: compareOperations([dibaPhase(10, { note: 'urgente' })], [busPhase(10, { note: 'urgente' })], [netPhase(10)]) })) },
    { name: 'preview: a material to add to Business, a quantity to correct in NetPro, one to remove, the placeholder to remove', expected: [{ materials: [fmt(preview.materialAdd, { code: 'CARTA', where: preview.where.bus, qty: quantityText(12) }), fmt(preview.materialQty, { code: 'CARTA', where: preview.where.net, from: quantityText(10), to: quantityText(12) }), fmt(preview.materialRemove, { code: 'COLLA', where: preview.where.net }), fmt(preview.materialRemove, { code: PLACEHOLDER_MATERIAL, where: `${preview.where.diba}, ${preview.where.bus}` })] }], actual: () => groupsOf(comparisons({ materials: compareMaterials([dibaMaterial('CARTA', 12), dibaMaterial(PLACEHOLDER_MATERIAL, 1, 2)], [orderMaterial(PLACEHOLDER_MATERIAL, 1)], [orderMaterial('CARTA', 10), orderMaterial('COLLA', 3)], QTY) })) },
    { name: 'preview: a quantity of the impegno goes to every place that holds another, saying on how many rows', expected: [{ quantity: [fmt(preview.fact, { fact: t.quantityNames.ordered, place: 'OPERAZIONI.QTA_RICHIESTA', from: `${quantityText(1000)} ${fmt(t.factRows, { n: 2 })}`, to: quantityText(1500) })] }], actual: () => groupsOf(comparisons({ quantities: compareFacts([quantityRow(1500, [[1500, 3]], [[1500, 1], [1000, 2]])], QUANTITY_RULES) })) },
    { name: 'preview: a title goes to a place cut to what the place keeps', expected: [{ article: [fmt(preview.fact, { fact: t.articleNames.name, place: 'ORDINI.DESCRIZIONE', from: 'Vecchio', to: TITLE.slice(0, 10) })] }], actual: () => groupsOf(comparisons({ article: compareFacts([titleRow(TITLE, 'Vecchio')], ARTICLE_RULES) })) },
    { name: 'preview: the groups come in the order Riallinea works', expected: ['quantity', 'article', 'phases', 'materials'], actual: () => previewSync(comparisons({ quantities: compareFacts([quantityRow(1500, [[1000, 1]], [[1500, 1]])], QUANTITY_RULES), article: compareFacts([titleRow('Altro', TITLE.slice(0, 10))], ARTICLE_RULES), phases: compareOperations([dibaPhase(10)], [], [netPhase(10)]), materials: compareMaterials([dibaMaterial('CARTA', 12)], [], [orderMaterial('CARTA', 12)], QTY) })).map((group) => group.key) },

    // The differences of an edition: the badge's count and the list of the orders to realign
    { name: 'differences: an aligned edition has none', expected: [0, []], actual: () => { const all = compareOrder(managementData()); return [countDifferences(all), orderDifferences(all)]; } },
    { name: 'differences: counted by row that differs, each kind with the lines of the preview', expected: [3, [{ kind: 'phases', count: 2 }, { kind: 'materials', count: 1 }]], actual: () => { const all = compareOrder(managementData({ business_operations: [busPhase(10), busPhase(20, { codcent: 999 })], netpro_materials: [orderMaterial('CARTA', 10)] })); return [countDifferences(all), orderDifferences(all).map(({ kind, count }) => ({ kind, count }))]; } },
    { name: 'differences: what stays on the order because it was used is not counted', expected: 0, actual: () => countDifferences(compareOrder(managementData({ diba_operations: [dibaPhase(10), dibaPhase(20)], sync_keeps: { phases: [30], materials: [] } }))) },
    { name: 'differences: where Riallinea has nothing to change, the comparison says why (no impegno cliente)', expected: [{ kind: 'quantity', count: 1, changes: [], issues: [t.factNoImpegno] }, [t.factNoImpegno]], actual: () => { const [difference] = orderDifferences(compareOrder(managementData({ quantities: { rows: [quantityRow(undefined, [[1500, 1]], [[1500, 1]])] } }))); return [difference, differenceLines(difference)]; } },
    { name: `differences: an order without a quantity is compared as ${APP_CONFIG.ORDERS.DEFAULT_QUANTITY} copies`, expected: ['CARTA exp 12 bus 12 net 12'], actual: () => materialSummary(compareOrder(managementData({ order_father_quant: undefined })).materials) },

    // The rows a realign writes for a phase the order lacks
    { name: 'new phase: the NetPro operation id is the order id and the phase on two digits', expected: ['H26 000000674001080', 'H26 000000674001005', 'H26 0000006740010120'], actual: () => [80, 5, 120].map((fase) => netOperId('H26 0000006740010', fase)) },
    { name: 'new phase in NetPro: operation, task and job with the DiBa values, the note cut, nobody worked on it', expected: { idOper: 'H26 X05', OPERAZIONI: { ORDINE: 'H26 X', OPERAZIONE: '05', ID_OPER: 'H26 X05', SEQUENZA: 5, DESCRIZIONE: 'PIEGA', CENTRO_ASSEGNATO: '505', CENTRO_REALE: '505', DESCRIZIONE01: 'N'.repeat(100), CENTRO_SUCCESSIVO: null, QTA_BASE: QTY, QTA_IMPIEGO: 1, QTA_RICHIESTA: QTY, STATO: UNSTARTED, DATA_INS: NOW, DATA_UPD: NOW }, TASKS: { TASK: 'H26 X05', DESCRIZIONE: 'PIEGA', MACCHINA: '505', MACCHINA_ASSEGNATA: '505', QTA_RICHIESTA: QTY, STATO: UNSTARTED, DATA_INS: NOW }, JOBSET: { TASK: 'H26 X05', ORDINE: 'H26 X', OPERAZIONE: '05', ID_OPER: 'H26 X05', QTA_RICHIESTA: QTY } }, actual: () => buildNetProOverrides(NEW_PHASE, 'H26 X', QTY, NOW) },
    { name: 'new phase in NetPro: no note is no note', expected: null, actual: () => buildNetProOverrides({ ...NEW_PHASE, note: '' }, 'H26 X', QTY, NOW).OPERAZIONI.DESCRIZIONE01 },
    { name: 'new phase in Business: the activity and its centre, the whole note', expected: { attivit: { at_fase: 5, at_codlavo: 105, at_tempesepr: 90, at_qtapr: QTY, at_terzista: '', at_note: 'N'.repeat(130), at_cicloriga: 4, at_sufase: 0 }, assris: { as_fase: 5, as_codcent: 505 } }, actual: () => buildBusinessOverrides(NEW_PHASE, QTY) },

    // Report Ordini per Area: the hours of an order, the same on screen and in the PDF
    { name: 'order hours: an area without an expected speed counts in the hours worked, and adds no expected hours', expected: [`9001 worked 7 expected ${expectedOf(AREA_WITH_SPEED)} | ${AREA_WITH_SPEED} 5/${expectedOf(AREA_WITH_SPEED)}, ${AREA_WITHOUT_SPEED} 2/-`], actual: () => hoursSummary(sumOrderHours([areaRow('9001', AREA_WITH_SPEED, 5), areaRow('9001', AREA_WITHOUT_SPEED, 2)])) },
    { name: 'order hours: an area on two rows (two months): its hours are added, its expected hours count once', expected: [`9001 worked 8 expected ${expectedOf(AREA_WITH_SPEED)} | ${AREA_WITH_SPEED} 8/${expectedOf(AREA_WITH_SPEED)}`], actual: () => hoursSummary(sumOrderHours([areaRow('9001', AREA_WITH_SPEED, 5), areaRow('9001', AREA_WITH_SPEED, 3)])) },
    { name: 'order hours: every order on its own, in the order they first appear', expected: ['9002', '9001'], actual: () => sumOrderHours([areaRow('9002', AREA_WITH_SPEED, 1), areaRow('9001', AREA_WITH_SPEED, 1), areaRow('9002', AREA_WITHOUT_SPEED, 1)]).map((order) => order.display) },
    { name: 'order hours: the folding area is measured in sheets; without them it has no expected hours', expected: [expectedOf(FOLDING_AREA, 3000, 500), null, 500 / AREA_EXPECTED_VELOCITY[FOLDING_AREA as keyof typeof AREA_EXPECTED_VELOCITY]], actual: () => [sumOrderHours([areaRow('9001', FOLDING_AREA, 1)])[0].areas[0].expected, sumOrderHours([areaRow('9001', FOLDING_AREA, 1, { fogli: null })])[0].areas[0].expected, sumOrderHours([areaRow('9001', FOLDING_AREA, 1)])[0].expected] },
    { name: 'order hours: an order without a description or a client has them empty; no rows, no orders', expected: [['', ''], []], actual: () => { const [order] = sumOrderHours([areaRow('9001', AREA_WITH_SPEED, 1, { order_description: null, client_name: null })]); return [[order.description, order.client], sumOrderHours([])]; } },

    // The production flow of an order
    { name: 'flow: the steps before the one running are taken as done; the cover has its own line', expected: [['TAGLIO CARTA:COM', 'PIEGA:EXE', 'CUCITURA:PENDING'], ['TAGLIO CARTONE:PENDING', 'COPERTINE:PENDING']], actual: () => { const flow = buildProductionFlow([flowStep('CUCITURA', 'PENDING'), flowStep('PIEGA', 'EXE'), flowStep('TAGLIO CARTA', 'PENDING'), flowStep('COPERTINE', 'PENDING'), flowStep('TAGLIO CARTONE', 'PENDING')]); return [statuses(flow.blockOps), statuses(flow.coverOps)]; } },
    { name: 'flow: once the assembly has started, block and cover are done', expected: [['TAGLIO CARTA:COM', 'PIEGA:COM'], ['COPERTINE:COM'], ['MESSA IN COLLA:SUS', 'INCASSATURA:PENDING']], actual: () => { const flow = buildProductionFlow([flowStep('TAGLIO CARTA', 'PENDING'), flowStep('PIEGA', 'PENDING'), flowStep('COPERTINE', 'PENDING'), flowStep('MESSA IN COLLA', 'SUS'), flowStep('INCASSATURA', 'PENDING')]); return [statuses(flow.blockOps), statuses(flow.coverOps), statuses(flow.assemblyOps)]; } },
    { name: 'flow: the counts and the share done; a step of an unknown area is listed apart', expected: { total: 5, completed: 2, running: 1, paused: 0, progressPercent: 40, other: ['MAGAZZINO:PENDING'] }, actual: () => { const flow = buildProductionFlow([flowStep('TAGLIO CARTA', 'COM'), flowStep('PIEGA', 'PENDING'), flowStep('CUCITURA', 'EXE'), flowStep('STAMPA A CALDO', 'PENDING'), flowStep('MAGAZZINO', 'PENDING')]); return { total: flow.total, completed: flow.completed, running: flow.running, paused: flow.paused, progressPercent: flow.progressPercent, other: statuses(flow.otherOps) }; } },
    { name: 'flow: an order without steps is at 0', expected: [0, 0], actual: () => { const flow = buildProductionFlow([]); return [flow.total, flow.progressPercent]; } },
];

let failed = 0;
for (const { name, expected, actual } of EXAMPLES) {
    const want = JSON.stringify(expected);
    const got = JSON.stringify(actual());
    const pass = want === got;
    if (!pass) failed++;
    console.log(`${pass ? 'OK  ' : 'FAIL'} ${name}`);
    if (!pass) {
        console.log(`     expected ${want}`);
        console.log(`     actual   ${got}`);
    }
}
console.log(`\n${EXAMPLES.length - failed}/${EXAMPLES.length} examples pass`);
process.exit(failed > 0 ? 1 : 0);
