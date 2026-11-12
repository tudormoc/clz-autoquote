/**
 * "Riallinea": rewrites the Business and NetPro production order of one edition in place from its impegno cliente row and
 * its DiBa (the truth), keeping the order ids. WRITES to both production databases, one transaction each (withTransactions);
 * see docs/ORDER_PROCESS.md.
 *
 * - Business: movord (tipo H: quantities, title, composition, measures), movdis (per pieces), artico (title,
 *   measures), attivit, assris,
 *   movord (tipo Y), keyord
 * - NetPro: ORDINI (quantity, title), ANAG_MATERIALI (title), OPERAZIONI, TASKS, JOBSET, MATERIALI_ORDINI
 * artpro is intentionally left untouched (NetPro handles it when the order is completed).
 * One edition at a time: every edition of an impegno is an article with its own order row, phases, materials and NetPro
 * order, and every Business statement names the edition's row (see PHASES_OF_EDITION below).
 */
import { APP_CONFIG, BUSINESS_COMPANY } from '@/config/constants';
import { queryMSSQL, withTransactions, type SqlRunner } from '@/lib/mssql';
import { dibaMaterialQty, isPlaceholderMaterial, NETPRO_NOTE_LEN, PLACEHOLDER_MATERIAL } from '@/lib/orders/compare';
import * as readDiba from '@/lib/orders/dibaData';
import { cutToPlace } from '@/lib/orders/documentFacts';
import { diffSnapshots, snapshotOrder, type RowChange } from '@/lib/orders/snapshot';
import { hasWorkSql, rowExists, usedInNetproSql, WITHDRAWN_IN_BUSINESS_SQL } from '@/lib/orders/sql';
import {
    materialRowsLeaving, NO_KEEPS, phaseStarted, phasesLeaving, syncBlocks, syncBlockText, syncKeeps,
    type DibaMaterialLine, type OrderMaterialFact, type OrderPhaseFact,
} from '@/lib/orders/syncBlocks';
import { buildBusinessOverrides, buildNetProOverrides, cloneRowInsert, firstMaterialCopies, netOperId, NOW } from '@/lib/orders/syncRows';
import { APP_COPY, fmt } from '@/locales';
import type { DibaMaterialRow, DibaOperationRow, KeptMaterial, SyncKeeps } from '@/types';

const copy = APP_COPY.analytics.orderOperations;

/** The ids of one edition's production order: its article, its Business order row and its NetPro order */
export interface SyncEdition {
    articleFather: string;
    anno: number;
    numord: number;
    /** Row of the H line in movord */
    rigaPadre: number;
    /** NetPro order id */
    netOrdine: string;
}

/** The order being realigned */
interface SyncTarget extends SyncEdition {
    /** Ordered quantity, from the impegno cliente row when there is one: the order row, its phases and NetPro follow it */
    orderFatherQuant: number;
    /** Maximum quantity to produce (Qta.Max.Prod of the impegno), kept on the order row */
    maxProduction: number;
    /** Title of the article (Titolo/Descrizione of the impegno row), written wherever the title is kept */
    title: string;
    /** The edition's commessa (mo_commeca of the H row) */
    commessa: number;
    /** Composizione and the measures (base, altezza, pages) of the impegno row, kept on the order row and the article master */
    composition: string;
    width: number;
    height: number;
    pages: number;
}

/** The order row of the Business order (movord tipo H) */
interface BusinessOrderRow {
    mo_anno: number;
    mo_serie: string;
    mo_numord: number;
    mo_riga: number;
    mo_codart: string;
    mo_quant: number;
    mo_colli: number;
    mo_descr: string;
    mo_matric: string;
    mo_misura1: number;
    mo_misura2: number;
    mo_misura3: number;
    mo_commeca: number;
    mo_datcons: Date;
    /** The NetPro production order of the row */
    mo_netpid: string;
}

/** A material row of the Business order (movord tipo Y) */
interface BusinessMaterialRow {
    mo_riga: number;
    codart: string;
    mo_quant: number;
    descr: string;
    unmis: string;
    disbasriga: number;
    /** 1 when the row was already withdrawn: Business marks it, or NetPro holds a picked or used quantity on it */
    withdrawn: number;
}

/** A phase of the NetPro order (OPERAZIONI) */
interface NetproPhaseRow {
    ID_OPER: string;
    SEQUENZA: number;
    DESCRIZIONE: string;
    STATO: string | null;
    /** 1 when work is recorded on it */
    hasWork: number;
}

/**
 * Done (with the rows that really changed, for the log; null when they could not be read back; and what was left on
 * the order because it was already used) or refused
 */
export type SyncResult =
    | { success: true; commessa: string; numord: number; netOrdine: string; changes: RowChange[] | null; kept: SyncKeeps }
    | { success: false; error: string };

/** What a realign of an edition would be stopped by, and what it would leave on the order */
export interface SyncLimits {
    blocks: string[];
    keeps: SyncKeeps;
}

const UNSTARTED = APP_CONFIG.ORDERS.UNSTARTED_OPERATION_STATE;

/**
 * Which production order to realign: an edition of an impegno is an article of its own, with its commessa, its order
 * row in Business and its NetPro order, realigned apart from the other editions (owner, 2026-11-05).
 */
export interface SyncOrderRef {
    /** The edition's commessa (e.g. 260999915) */
    commessa: string;
    /** Its NetPro production order, when the caller knows it (it is what tells apart the order rows of one commessa) */
    netproOrder?: string;
}

const sameCode = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * The rows of ONE edition in Business. An edition is known by its ids (article, commessa, NetPro order); Business hangs
 * its phases and material rows under the order row of the edition (riga 5, 10, 15 … of the production order: the key of
 * its own tables), with the same fase numbers in every edition. So every statement on them names that order row
 * (@rigaPadre), or one edition's DiBa would be written over the others; and before anything is written findTarget
 * checks that the rows under it carry the ids of the edition (rowsOfAnotherOrder).
 */
const PHASES_OF_EDITION = `codditt = '${BUSINESS_COMPANY}' AND at_tipork = 'H' AND at_anno = @anno AND at_numord = @numord AND at_riga = @rigaPadre`;
const RESOURCES_OF_EDITION = `codditt = '${BUSINESS_COMPANY}' AND as_tipork = 'H' AND as_anno = @anno AND as_numord = @numord AND as_riga = @rigaPadre`;
const MATERIALS_OF_EDITION = `codditt = '${BUSINESS_COMPANY}' AND mo_tipork = 'Y' AND mo_anno = @anno AND mo_numord = @numord AND mo_rigaor = @rigaPadre`;

/**
 * Phases and material rows under the order row that do NOT carry the ids of the edition: Business writes the NetPro
 * order and the article on every phase (at_netpid, at_coddb), the commessa and the NetPro order on every material row
 * (mo_commeca, mo_netpid). On the orders of 2026 they always agree with the order row (15.726 phases, 3.564 material
 * rows, read on 2026-11-06); one that does not means the order row is not what it seems, and nothing is written.
 */
async function rowsOfAnotherOrder(edition: { anno: number; numord: number; rigaPadre: number }, ids: { article: string; commessa: number; netOrdine: string }) {
    const res = await queryMSSQL<{ phases: number; materials: number }>(`
            SELECT
                (SELECT COUNT(*) FROM attivit WITH (NOLOCK)
                 WHERE ${PHASES_OF_EDITION} AND (ISNULL(RTRIM(at_netpid), '') <> @netOrdine OR ISNULL(RTRIM(at_coddb), '') <> @article)) AS phases,
                (SELECT COUNT(*) FROM movord WITH (NOLOCK)
                 WHERE ${MATERIALS_OF_EDITION} AND (ISNULL(mo_commeca, 0) <> @commessa OR ISNULL(RTRIM(mo_netpid), '') <> @netOrdine)) AS materials
        `, { ...edition, ...ids }, 'BUSINESS');
    return res.recordset[0];
}

/**
 * Finds the Business order row (movord H) of the edition and the NetPro order it points to. Refused: an article with
 * more than one production order on the commessa (a double: which one counts is still to be decided) and an order
 * that names another article in NetPro than in Business (to be fixed by hand).
 */
async function findTarget({ commessa, netproOrder }: SyncOrderRef): Promise<SyncTarget | string> {
    // A commessa is a number: anything else names no order
    if (!/^\d+$/.test(commessa)) return copy.syncNoOrder;
    const busOrderRes = await queryMSSQL<BusinessOrderRow>(`
            SELECT
                mo_anno, mo_serie, mo_numord, mo_riga, RTRIM(mo_codart) AS mo_codart, mo_quant, mo_colli, RTRIM(mo_descr) AS mo_descr,
                ISNULL(RTRIM(mo_matric), '') AS mo_matric, mo_misura1, mo_misura2, mo_misura3, mo_commeca, mo_datcons,
                ISNULL(RTRIM(mo_netpid), '') AS mo_netpid
            FROM movord WITH (NOLOCK)
            WHERE codditt = '${BUSINESS_COMPANY}'
              AND mo_tipork = 'H'
              AND mo_commeca = @commessa
            ORDER BY mo_anno DESC, mo_numord DESC, mo_riga ASC
        `, { commessa }, 'BUSINESS');
    const orderRows = busOrderRes.recordset;
    const busOrder = netproOrder ? orderRows.find((row) => row.mo_netpid === netproOrder.trim()) : orderRows[0];
    if (!busOrder) return copy.syncNoOrder;

    const anno = busOrder.mo_anno;
    const numord = busOrder.mo_numord;
    const rigaPadre = busOrder.mo_riga;
    const article = busOrder.mo_codart;
    const netOrdine = busOrder.mo_netpid || `H${String(anno).substring(2)} ${String(numord).padStart(9, '0')}${String(rigaPadre).padStart(4, '0')}`;

    const netOrdersRes = await queryMSSQL<{ ORDINE: string; PART_NUMBER: string }>(`
            SELECT RTRIM(ORDINE) AS ORDINE, ISNULL(RTRIM(PART_NUMBER), '') AS PART_NUMBER
            FROM ORDINI WITH (NOLOCK)
            WHERE TIPO = 'MAKE' AND COMMESSA = @commessa
        `, { commessa }, 'NETPRO');
    const netOrder = netOrdersRes.recordset.find((order) => order.ORDINE === netOrdine);
    if (!netOrder) return fmt(copy.syncNoNetproOrder, { order: netOrdine });
    if (netOrder.PART_NUMBER && !sameCode(netOrder.PART_NUMBER, article)) return fmt(copy.syncArticleDiffers, { business: article, netpro: netOrder.PART_NUMBER });

    // One article, one production order: with a second one on the commessa nothing is written until the owner decides which counts
    const business = orderRows.filter((row) => sameCode(row.mo_codart, article)).length;
    const netpro = netOrdersRes.recordset.filter((order) => sameCode(order.PART_NUMBER, article)).length;
    if (business > 1 || netpro > 1) return fmt(copy.syncDoubleOrder, { business, netpro });

    // The order row is where Business keeps the edition's phases and materials: they must carry the edition's own ids
    const foreign = await rowsOfAnotherOrder({ anno, numord, rigaPadre }, { article, commessa: Number(busOrder.mo_commeca), netOrdine });
    if (foreign.phases > 0 || foreign.materials > 0) return fmt(copy.syncRowsOfAnotherOrder, foreign);

    // The impegno cliente row that generated the order (same commessa and article): the truth for the quantities
    const impegnoRes = await queryMSSQL<Pick<BusinessOrderRow, 'mo_anno' | 'mo_numord' | 'mo_quant' | 'mo_colli' | 'mo_descr' | 'mo_matric' | 'mo_misura1' | 'mo_misura2' | 'mo_misura3'>>(`
            SELECT TOP 1 mo_anno, mo_numord, mo_quant, mo_colli, RTRIM(mo_descr) AS mo_descr,
                   ISNULL(RTRIM(mo_matric), '') AS mo_matric, mo_misura1, mo_misura2, mo_misura3
            FROM movord WITH (NOLOCK)
            WHERE codditt = '${BUSINESS_COMPANY}' AND mo_tipork = 'R' AND mo_commeca = @commeca AND mo_codart = @codart
            ORDER BY mo_anno DESC, mo_numord DESC
        `, { commeca: busOrder.mo_commeca, codart: article }, 'BUSINESS');
    const impegno = impegnoRes.recordset[0];
    const source = impegno ?? busOrder;

    return {
        // The article is the one of the Business order row: its DiBa is the one realigned from
        articleFather: article,
        orderFatherQuant: Number(source.mo_quant) || APP_CONFIG.ORDERS.DEFAULT_QUANTITY,
        maxProduction: Number(source.mo_colli) || 0,
        title: (source.mo_descr ?? '').trim(),
        commessa: Number(busOrder.mo_commeca),
        composition: (source.mo_matric ?? '').trim(),
        width: Number(source.mo_misura1) || 0,
        height: Number(source.mo_misura2) || 0,
        pages: Number(source.mo_misura3) || 0,
        anno,
        numord,
        rigaPadre,
        netOrdine,
    };
}

/**
 * Quantities (owner's rules, 2026-11-04): the ordered quantity and the maximum to produce come from the impegno cliente row
 * and go to the production order row and the NetPro order; the DiBa's "per pieces" (md_perpz) becomes the ordered quantity on
 * every material row (not the MP_FITTIZIA placeholder's, which is never a material of the order), so the material quantities
 * stay as typed in the DiBa (a material changes only when the DiBa is edited).
 * The phases, operations, tasks, jobset and materials follow in syncPhases / syncMaterials with the same quantity.
 * Each write only where the value differs. Left alone: the sales order and the bridge rows (Business keeps them) and the
 * document headers (Business does not maintain them either).
 */
async function syncQuantities(run: SqlRunner, { articleFather, orderFatherQuant, maxProduction, anno, numord, rigaPadre, netOrdine }: SyncTarget) {
    await run(`
            UPDATE movdis
            SET md_perpz = @qty
            WHERE codditt = '${BUSINESS_COMPANY}' AND md_coddb = @articleFather AND md_codfigli <> @placeholder
              AND (md_perpz IS NULL OR md_perpz <> @qty)
        `, { qty: orderFatherQuant, articleFather, placeholder: PLACEHOLDER_MATERIAL }, 'BUSINESS');

    await run(`
            UPDATE movord
            SET mo_quant = @qty, mo_colli = @colli, mo_ultagg = GETDATE()
            WHERE codditt = '${BUSINESS_COMPANY}' AND mo_tipork = 'H' AND mo_anno = @anno AND mo_numord = @numord AND mo_riga = @rigaPadre
              AND (ISNULL(mo_quant, 0) <> @qty OR ISNULL(mo_colli, 0) <> @colli)
        `, { qty: orderFatherQuant, colli: maxProduction, anno, numord, rigaPadre }, 'BUSINESS');

    await run(`UPDATE ORDINI SET QTA_RICHIESTA = @qty WHERE ORDINE = @netOrdine AND ISNULL(QTA_RICHIESTA, 0) <> @qty`,
        { qty: orderFatherQuant, netOrdine }, 'NETPRO');
}

/**
 * Article data (owner's rule 2026-11-04): the impegno cliente row's title goes to the production order row, the Business article
 * master, the NetPro order and the NetPro article master, each cut to what its column keeps (NOT to the document headers or the
 * commessa: the impegno header has its own reference text, which Business's trigger copies into the commessa, and Business leaves
 * the production order's headers empty); its composition goes to the order row,
 * its measures (base, altezza, pages) to the order row and the Business article master (NetPro has no field for them).
 * Only where it differs.
 */
async function syncArticle(run: SqlRunner, { articleFather, title, composition, width, height, pages, anno, numord, rigaPadre, netOrdine }: SyncTarget) {
    if (!title) return;
    const lengths = APP_CONFIG.ORDERS.TITLE_LENGTHS;
    await run(`
            UPDATE movord
            SET mo_descr = @title, mo_matric = @composition, mo_misura1 = @width, mo_misura2 = @height, mo_misura3 = @pages, mo_ultagg = GETDATE()
            WHERE codditt = '${BUSINESS_COMPANY}' AND mo_tipork = 'H' AND mo_anno = @anno AND mo_numord = @numord AND mo_riga = @rigaPadre
              AND (ISNULL(mo_descr, '') <> @title OR ISNULL(mo_matric, '') <> @composition OR ISNULL(mo_misura1, 0) <> @width OR ISNULL(mo_misura2, 0) <> @height OR ISNULL(mo_misura3, 0) <> @pages)
        `, { title: cutToPlace(title, lengths.movord), composition: cutToPlace(composition, lengths.movord), width, height, pages, anno, numord, rigaPadre }, 'BUSINESS');
    await run(`
            UPDATE artico SET ar_descr = @title, ar_misura1 = @width, ar_misura2 = @height, ar_misura3 = @pages, ar_ultagg = GETDATE()
            WHERE codditt = '${BUSINESS_COMPANY}' AND ar_codart = @articleFather
              AND (ISNULL(ar_descr, '') <> @title OR ISNULL(ar_misura1, 0) <> @width OR ISNULL(ar_misura2, 0) <> @height OR ISNULL(ar_misura3, 0) <> @pages)
        `, { title: cutToPlace(title, lengths.artico), width, height, pages, articleFather }, 'BUSINESS');
    await run(`UPDATE ORDINI SET DESCRIZIONE = @title, DATA_UPD = GETDATE() WHERE ORDINE = @netOrdine AND ISNULL(DESCRIZIONE, '') <> @title`,
        { title: cutToPlace(title, lengths.netproOrder), netOrdine }, 'NETPRO');
    await run(`UPDATE ANAG_MATERIALI SET DESCRIZIONE = @title, DATA_UPD = GETDATE() WHERE PART_NUMBER = @articleFather AND ISNULL(DESCRIZIONE, '') <> @title`,
        { title: cutToPlace(title, lengths.netproArticle), articleFather }, 'NETPRO');
}

/**
 * The phases of the article's DiBa in phase order, read through the realign's transaction: the same read the order
 * page compares with (dibaData.ts)
 */
async function readDibaPhases(run: SqlRunner, articleFather: string): Promise<DibaOperationRow[]> {
    return [...(await readDiba.readDibaPhases(articleFather, run))].sort((a, b) => a.fase - b.fase);
}

/** The phases of the NetPro order (OPERAZIONI), with their state and whether work is recorded on them */
async function readOrderPhases(run: SqlRunner, netOrdine: string): Promise<NetproPhaseRow[]> {
    const netOpsRes = await run<NetproPhaseRow>(`
            SELECT ID_OPER, SEQUENZA, DESCRIZIONE, STATO, ${hasWorkSql('OPERAZIONI.ID_OPER')} AS hasWork
            FROM OPERAZIONI WITH (NOLOCK)
            WHERE ORDINE = @netOrdine
            ORDER BY SEQUENZA ASC
        `, { netOrdine }, 'NETPRO');
    return netOpsRes.recordset;
}

/** The rows of the realign as the removal rules read them (syncBlocks.ts) */
const phaseFact = (op: NetproPhaseRow): OrderPhaseFact => ({ fase: Number(op.SEQUENZA), started: phaseStarted(op.STATO, op.hasWork) });
const dibaLine = (m: DibaMaterialRow): DibaMaterialLine => ({ riga: Number(m.riga), code: m.codfigli });
const materialFact = (m: BusinessMaterialRow): OrderMaterialFact => ({ riga: Number(m.mo_riga), dibaRiga: Number(m.disbasriga), code: m.codart, withdrawn: Boolean(m.withdrawn) });

/**
 * Phases: adds those missing in the order, then removes those no longer in the DiBa, and refreshes the others. A phase
 * somebody already worked on is not removed (syncBlocks.ts): the fasi left on the order are given back.
 */
async function syncPhases(run: SqlRunner, { articleFather, orderFatherQuant, anno, numord, rigaPadre, netOrdine }: SyncTarget): Promise<number[]> {
    const edition = { anno, numord, rigaPadre };
    const dibaOps = await readDibaPhases(run, articleFather);
    const netOps = await readOrderPhases(run, netOrdine);

    const netFasi = new Set(netOps.map((o) => o.SEQUENZA));
    const leaving = phasesLeaving(netOps.map(phaseFact), dibaOps.map((o) => o.fase));
    const removed = new Set(leaving.removed.map((phase) => phase.fase));
    const kept = leaving.kept.map((phase) => Number(phase.fase));

    // In the DiBa but not in the order: rows cloned from existing rows of this edition (so the copy keeps its order row,
    // article and NetPro order), unless already there. Added BEFORE the old ones are removed: when every phase of the
    // order is replaced, the phases to remove are the only rows left to copy from
    for (const op of dibaOps.filter((o) => !netFasi.has(o.fase))) {
        const ov = buildNetProOverrides(op, netOrdine, orderFatherQuant, NOW);
        const bv = buildBusinessOverrides(op, orderFatherQuant);

        if (!(await rowExists(run, 'OPERAZIONI', 'ID_OPER = @id', { id: ov.idOper }, 'NETPRO'))) {
            await cloneRowInsert(run, 'NETPRO', 'OPERAZIONI', 'ORDINE = @netOrdine', { netOrdine }, ov.OPERAZIONI);
        }
        if (!(await rowExists(run, 'TASKS', 'TASK = @id', { id: ov.idOper }, 'NETPRO'))) {
            await cloneRowInsert(run, 'NETPRO', 'TASKS', 'TASK IN (SELECT TASK FROM JOBSET WHERE ORDINE = @netOrdine)', { netOrdine }, ov.TASKS);
        }
        if (!(await rowExists(run, 'JOBSET', 'ID_OPER = @id AND TASK = @id', { id: ov.idOper }, 'NETPRO'))) {
            await cloneRowInsert(run, 'NETPRO', 'JOBSET', 'ORDINE = @netOrdine', { netOrdine }, ov.JOBSET);
        }
        if (!(await rowExists(run, 'attivit', `${PHASES_OF_EDITION} AND at_fase = @fase`, { ...edition, fase: op.fase }, 'BUSINESS'))) {
            await cloneRowInsert(run, 'BUSINESS', 'attivit', PHASES_OF_EDITION, edition, bv.attivit);
        }
        if (!(await rowExists(run, 'assris', `${RESOURCES_OF_EDITION} AND as_fase = @fase`, { ...edition, fase: op.fase }, 'BUSINESS'))) {
            await cloneRowInsert(run, 'BUSINESS', 'assris', RESOURCES_OF_EDITION, edition, bv.assris);
        }
    }

    // In the order but not in the DiBa, and never worked on: removed from both databases. The operation goes first,
    // and only while it is still untouched: one that somebody started since it was read stays, with all its rows
    for (const op of netOps.filter((o) => removed.has(Number(o.SEQUENZA)))) {
        const gone = await run(`DELETE FROM OPERAZIONI WHERE ID_OPER = @id_oper AND RTRIM(STATO) = @unstarted`, { id_oper: op.ID_OPER, unstarted: UNSTARTED }, 'NETPRO');
        if (gone.rowsAffected[0] === 0 && (await rowExists(run, 'OPERAZIONI', 'ID_OPER = @id', { id: op.ID_OPER }, 'NETPRO'))) {
            kept.push(Number(op.SEQUENZA));
            continue;
        }
        await run(`DELETE FROM JOBSET WHERE ID_OPER = @id_oper`, { id_oper: op.ID_OPER }, 'NETPRO');
        await run(`DELETE FROM TASKS WHERE TASK = @id_oper`, { id_oper: op.ID_OPER }, 'NETPRO');
        await run(`DELETE FROM assris WHERE ${RESOURCES_OF_EDITION} AND as_fase = @fase`, { ...edition, fase: op.SEQUENZA }, 'BUSINESS');
        await run(`DELETE FROM attivit WHERE ${PHASES_OF_EDITION} AND at_fase = @fase`, { ...edition, fase: op.SEQUENZA }, 'BUSINESS');
    }

    // In both: every field that can change is taken again from the DiBa
    for (const op of dibaOps.filter((o) => netFasi.has(o.fase))) {
        const idOper = netOperId(netOrdine, op.fase);

        // Business attivit — work type, planned time (sec), planned qty, terzista, notes
        await run(`
                UPDATE attivit
                SET at_codlavo    = @codlavo,
                    at_tempesepr  = @tesec,
                    at_qtapr      = @orderFatherQuant,
                    at_terzista   = @terzista,
                    at_note       = @note
                WHERE ${PHASES_OF_EDITION} AND at_fase = @fase
            `, { codlavo: op.codlavo, tesec: op.tesec, orderFatherQuant, terzista: op.terzista, note: op.note || null, ...edition, fase: op.fase }, 'BUSINESS');

        // Business assris — work center
        await run(`
                UPDATE assris
                SET as_codcent = @codcent
                WHERE ${RESOURCES_OF_EDITION} AND as_fase = @fase
            `, { codcent: op.codcent, ...edition, fase: op.fase }, 'BUSINESS');

        // NetPro OPERAZIONI — description, work centers (real centre only if not manually reassigned), qty
        await run(`
                UPDATE OPERAZIONI
                SET DESCRIZIONE      = @descr,
                    DESCRIZIONE01    = @note,
                    CENTRO_REALE     = CASE WHEN CENTRO_REALE = CENTRO_ASSEGNATO THEN @centro ELSE CENTRO_REALE END,
                    CENTRO_ASSEGNATO = @centro,
                    T_LAVORO_MAC     = @tesec,
                    QTA_BASE         = @orderFatherQuant,
                    QTA_RICHIESTA    = @orderFatherQuant
                WHERE ID_OPER = @idOper
            `, { descr: op.descr_lavor, centro: String(op.codcent), tesec: op.tesec, note: op.note ? op.note.slice(0, NETPRO_NOTE_LEN) : null, orderFatherQuant, idOper }, 'NETPRO');

        // NetPro TASKS — description, machine, notes, qty
        await run(`
                UPDATE TASKS
                SET DESCRIZIONE        = @descr,
                    MACCHINA_ASSEGNATA = CASE WHEN MACCHINA_ASSEGNATA = MACCHINA THEN @centro ELSE MACCHINA_ASSEGNATA END,
                    MACCHINA           = @centro,
                    QTA_RICHIESTA      = @orderFatherQuant,
                    DATA_UPD           = CASE WHEN DESCRIZIONE = @descr AND MACCHINA = @centro AND QTA_RICHIESTA = @orderFatherQuant THEN DATA_UPD ELSE GETDATE() END
                WHERE TASK = @idOper
            `, { descr: op.descr_lavor, centro: String(op.codcent), orderFatherQuant, idOper }, 'NETPRO');

        // NetPro JOBSET — qty
        await run(`UPDATE JOBSET SET QTA_RICHIESTA = @orderFatherQuant WHERE ID_OPER = @idOper`,
            { orderFatherQuant, idOper }, 'NETPRO');
    }
    return kept;
}

/** Phase chain: NetPro CENTRO_SUCCESSIVO and Business at_sufase point to the next phase */
async function syncPhaseChain(run: SqlRunner, { anno, numord, rigaPadre, netOrdine }: SyncTarget) {
    const chainRes = await run<{ ID_OPER: string; SEQUENZA: number; CENTRO_ASSEGNATO: string; CENTRO_SUCCESSIVO: string | null }>(`
            SELECT ID_OPER, SEQUENZA, CENTRO_ASSEGNATO, CENTRO_SUCCESSIVO
            FROM OPERAZIONI WITH (NOLOCK) WHERE ORDINE = @netOrdine ORDER BY SEQUENZA ASC
        `, { netOrdine }, 'NETPRO');
    const chainOps = chainRes.recordset;
    for (let i = 0; i < chainOps.length; i++) {
        const next = chainOps[i + 1];
        const wantCentro = next ? String(next.CENTRO_ASSEGNATO) : null;
        if ((chainOps[i].CENTRO_SUCCESSIVO ?? null) !== wantCentro) {
            await run(`UPDATE OPERAZIONI SET CENTRO_SUCCESSIVO = @c WHERE ID_OPER = @id`,
                { c: wantCentro, id: chainOps[i].ID_OPER }, 'NETPRO');
        }
        await run(`
                UPDATE attivit
                SET at_sufase = @next, at_suanno = @suanno, at_sunumord = @sunumord, at_suriga = @suriga
                WHERE ${PHASES_OF_EDITION} AND at_fase = @fase
            `, {
            next: next ? next.SEQUENZA : 0,
            suanno: next ? anno : 0, sunumord: next ? numord : 0, suriga: next ? rigaPadre : 0,
            anno, numord, rigaPadre, fase: chainOps[i].SEQUENZA,
        }, 'BUSINESS');
    }
}

/** The real materials of the article's DiBa (the same read as the order page, dibaData.ts), without the placeholder */
async function readDibaMaterials(run: SqlRunner, articleFather: string): Promise<DibaMaterialRow[]> {
    return (await readDiba.readDibaMaterials(articleFather, run)).filter((m) => !isPlaceholderMaterial(m.codfigli));
}

/**
 * The material rows of the edition in the Business order (movord tipo Y), without the placeholder. A row counts as
 * withdrawn when Business marks it, or when NetPro holds a picked or used quantity on it.
 */
async function readOrderMaterials(run: SqlRunner, edition: { anno: number; numord: number; rigaPadre: number }, netOrdine: string): Promise<BusinessMaterialRow[]> {
    const busMatRes = await run<BusinessMaterialRow>(`
            SELECT
                mo_riga, RTRIM(mo_codart) as codart, mo_quant, RTRIM(mo_descr) as descr, RTRIM(mo_unmis) as unmis,
                mo_disbasriga as disbasriga, ${WITHDRAWN_IN_BUSINESS_SQL} as withdrawn
            FROM movord WITH (NOLOCK)
            WHERE ${MATERIALS_OF_EDITION}
            ORDER BY mo_riga ASC
        `, edition, 'BUSINESS');
    // NetPro keeps the same row number as Business (SEQUENZA = mo_riga)
    const usedRes = await run<{ riga: number }>(`
            SELECT MO.SEQUENZA AS riga
            FROM MATERIALI_ORDINI AS MO WITH (NOLOCK)
            WHERE MO.ORDINE = @netOrdine AND ${usedInNetproSql('MO')} = 1
        `, { netOrdine }, 'NETPRO');
    const usedInNetpro = new Set(usedRes.recordset.map((row) => Number(row.riga)));
    return busMatRes.recordset
        .filter((m) => !isPlaceholderMaterial(m.codart))
        .map((m) => ({ ...m, withdrawn: Number(m.withdrawn) || usedInNetpro.has(Number(m.mo_riga)) ? 1 : 0 }));
}

/**
 * What stops the realign of the edition and what it would leave on the order (syncBlocks.ts), read only, on the rows
 * the realign itself removes by. The realign asks through its transaction right before the first write; the
 * comparison asks the same (management.ts), so the list and the order page say what the button will do.
 */
export async function findSyncLimits(run: SqlRunner, { articleFather, anno, numord, rigaPadre, netOrdine }: SyncEdition): Promise<SyncLimits> {
    const dibaOps = await readDibaPhases(run, articleFather);
    const netOps = await readOrderPhases(run, netOrdine);
    const dibaMat = await readDibaMaterials(run, articleFather);
    const busMat = await readOrderMaterials(run, { anno, numord, rigaPadre }, netOrdine);
    const facts = {
        article: articleFather,
        dibaPhases: dibaOps.map((op) => Number(op.fase)),
        orderPhases: netOps.map(phaseFact),
        dibaMaterials: dibaMat.map(dibaLine),
        orderMaterials: busMat.map(materialFact),
    };
    return { blocks: syncBlocks(facts), keeps: syncKeeps(facts) };
}

/**
 * Materials: rows linked like the official process — Business Y row ↔ DiBa row via mo_disbasriga = md_riga,
 * NetPro row ↔ Business row via MATERIALI_ORDINI.SEQUENZA = mo_riga (a DiBa can list the same code twice).
 * MP_FITTIZIA is never added; once the DiBa has a real material it is removed everywhere (removePlaceholder).
 * A row already withdrawn is not removed (syncBlocks.ts): the rows left on the order are given back.
 */
async function syncMaterials(run: SqlRunner, { articleFather, orderFatherQuant, anno, numord, rigaPadre, netOrdine }: SyncTarget): Promise<KeptMaterial[]> {
    const edition = { anno, numord, rigaPadre };
    const dibaMat = await readDibaMaterials(run, articleFather);
    const busMat = await readOrderMaterials(run, edition, netOrdine);

    const busByDibaRiga = new Map<number, BusinessMaterialRow>();
    for (const m of busMat) busByDibaRiga.set(Number(m.disbasriga), m);
    // A new row takes the next number of the WHOLE order: its material rows are numbered across the editions (edition 5
    // holds rows 5-15, edition 10 row 20 …; MP_FITTIZIA included), so the number after an edition's last row is not free
    const lastRigaRes = await run<{ riga: number }>(`
            SELECT ISNULL(MAX(mo_riga), 0) AS riga
            FROM movord WITH (NOLOCK)
            WHERE codditt = '${BUSINESS_COMPANY}' AND mo_tipork = 'Y' AND mo_anno = @anno AND mo_numord = @numord
        `, { anno, numord }, 'BUSINESS');
    let maxRiga = Number(lastRigaRes.recordset[0]?.riga) || 0;

    // The order rows with no place in the DiBa any more (its line is gone or now holds another code): told apart on the
    // rows as they are now, removed at the end; those already withdrawn stay
    const leaving = materialRowsLeaving(busMat.map(materialFact), dibaMat.map(dibaLine));
    const removed = new Set(leaving.removed.map((row) => row.riga));
    // An order can have no material at all, and get its first one now: that row has no row of the edition to copy
    const firstMaterial = firstMaterialCopies(run, edition, netOrdine);

    // DiBa materials: quantity updated when the row exists, new rows added otherwise. Added BEFORE the old rows are
    // removed: in Business a DiBa line cannot change its code, a material is replaced by deleting its line and adding
    // a new one (owner, 2026-11-06), and with one material the row to remove is the only one left to copy from
    for (const dm of dibaMat) {
        const expectedQuant = dibaMaterialQty(orderFatherQuant, dm.quant, dm.perpz);
        // NetPro QTA_IMPIEGO = quantity per produced piece (e.g. 1200 / 1358)
        const qtaImpiego = orderFatherQuant ? expectedQuant / orderFatherQuant : 0;
        const existing = busByDibaRiga.get(Number(dm.riga));

        if (existing && existing.codart === dm.codfigli) {
            const riga = existing.mo_riga;
            await run(`
                    UPDATE movord
                    SET mo_quant = @expectedQuant, mo_colli = @expectedQuant, mo_ultagg = GETDATE()
                    WHERE codditt = '${BUSINESS_COMPANY}' AND mo_numord = @numord AND mo_anno = @anno AND mo_tipork = 'Y' AND mo_riga = @riga
                      AND (mo_quant <> @expectedQuant OR mo_colli <> @expectedQuant)
                `, { expectedQuant, numord, anno, riga }, 'BUSINESS');

            await run(`
                    UPDATE MATERIALI_ORDINI
                    SET QUANTITA = @expectedQuant, QTA_IMPIEGO = @qtaImpiego
                    WHERE ORDINE = @netOrdine AND SEQUENZA = @riga
                `, { expectedQuant, qtaImpiego, netOrdine, riga }, 'NETPRO');
        } else {
            maxRiga += 5;
            const newRiga = maxRiga;

            // Business movord (cloned from a material row of this edition, so the copy keeps its order row, commessa and
            // NetPro order; price fields not recalculated). An edition without any material row takes the copy from
            // another order, with its own order's ids on it (firstMaterial)
            await cloneRowInsert(run, 'BUSINESS', 'movord', MATERIALS_OF_EDITION, edition, {
                mo_riga: newRiga, mo_codart: dm.codfigli, mo_unmis: dm.unmis || 'Nr', mo_ump: dm.unmis || 'Nr',
                mo_descr: dm.description, mo_colli: expectedQuant, mo_quant: expectedQuant,
                mo_prezzo: 0, mo_valore: 0, mo_valoremm: 0, mo_desint: dm.desint || null, mo_stasino: 'N',
                mo_disbasriga: dm.riga, mo_ultagg: NOW,
            }, firstMaterial.movord);
            // Business keyord (ko_conto, ko_commeca etc. copied from a row of this edition)
            await cloneRowInsert(run, 'BUSINESS', 'keyord',
                `codditt = '${BUSINESS_COMPANY}' AND ko_tipork = 'Y' AND ko_anno = @anno AND ko_numord = @numord
                 AND ko_riga IN (SELECT mo_riga FROM movord WITH (NOLOCK) WHERE ${MATERIALS_OF_EDITION})`, edition,
                { ko_riga: newRiga, ko_codart: dm.codfigli }, firstMaterial.keyord);
            // NetPro MATERIALI_ORDINI (cloned from an existing row of this order)
            await cloneRowInsert(run, 'NETPRO', 'MATERIALI_ORDINI', 'ORDINE = @netOrdine', { netOrdine }, {
                SEQUENZA: newRiga, PART_NUMBER: dm.codfigli, QUANTITA: expectedQuant, QTA_IMPIEGO: qtaImpiego,
            }, firstMaterial.netpro);
        }
    }

    // Order rows whose DiBa row is gone or now holds a different code are removed, unless already withdrawn
    for (const m of busMat.filter((row) => removed.has(Number(row.mo_riga)))) {
        await run(`
                DELETE FROM keyord
                WHERE codditt = '${BUSINESS_COMPANY}' AND ko_numord = @numord AND ko_anno = @anno AND ko_tipork = 'Y' AND ko_riga = @riga
            `, { numord, anno, riga: m.mo_riga }, 'BUSINESS');

        await run(`
                DELETE FROM movord
                WHERE codditt = '${BUSINESS_COMPANY}' AND mo_numord = @numord AND mo_anno = @anno AND mo_tipork = 'Y' AND mo_riga = @riga
            `, { numord, anno, riga: m.mo_riga }, 'BUSINESS');

        await run(`
                DELETE FROM MATERIALI_ORDINI
                WHERE ORDINE = @netOrdine AND SEQUENZA = @riga
            `, { netOrdine, riga: m.mo_riga }, 'NETPRO');
    }

    if (dibaMat.length > 0) await removePlaceholder(run, { articleFather, anno, numord, rigaPadre, netOrdine });
    return leaving.kept.map(({ riga, code }) => ({ riga, code }));
}

/**
 * MP_FITTIZIA exists only so that NetPro sees one material on an order that has none (owner, 2026-11-04): Riallinea never
 * adds it, and once the DiBa has a real material it goes from the DiBa, the Business order (movord Y + keyord) and NetPro.
 */
async function removePlaceholder(run: SqlRunner, { articleFather, anno, numord, rigaPadre, netOrdine }: Pick<SyncTarget, 'articleFather' | 'anno' | 'numord' | 'rigaPadre' | 'netOrdine'>) {
    const params = { anno, numord, rigaPadre, placeholder: PLACEHOLDER_MATERIAL };
    await run(`
            DELETE FROM keyord
            WHERE codditt = '${BUSINESS_COMPANY}' AND ko_tipork = 'Y' AND ko_anno = @anno AND ko_numord = @numord
              AND ko_riga IN (SELECT mo_riga FROM movord WHERE ${MATERIALS_OF_EDITION} AND mo_codart = @placeholder)
        `, params, 'BUSINESS');
    await run(`DELETE FROM movord WHERE ${MATERIALS_OF_EDITION} AND mo_codart = @placeholder`, params, 'BUSINESS');
    await run(`DELETE FROM MATERIALI_ORDINI WHERE ORDINE = @netOrdine AND PART_NUMBER = @placeholder`,
        { netOrdine, placeholder: PLACEHOLDER_MATERIAL }, 'NETPRO');
    await run(`DELETE FROM movdis WHERE codditt = '${BUSINESS_COMPANY}' AND md_coddb = @articleFather AND md_codfigli = @placeholder`,
        { articleFather, placeholder: PLACEHOLDER_MATERIAL }, 'BUSINESS');
}

/**
 * Realigns the production order of one edition to its impegno and its DiBa: quantities, article data, phases, phase chain,
 * materials (in this order). The other editions of the commessa are not touched.
 * What was already used is never removed (syncBlocks.ts): a phase somebody worked on and a material already withdrawn
 * stay on the order, the rest is realigned, and the result says what stayed. Refused, with nothing written, for an
 * article without DiBa phases (every phase would go).
 * All the writes run in one transaction per database: if any statement fails, both orders stay as they were.
 */
export async function syncOrderFromDiba(order: SyncOrderRef): Promise<SyncResult> {
    const target = await findTarget(order);
    if (typeof target === 'string') return { success: false, error: target };

    // The order's rows before and after: their difference is what the realign really changed (for the log)
    const commessa = String(target.commessa);
    const before = await snapshotOrder(queryMSSQL, commessa);

    const { blocks, kept } = await withTransactions(['BUSINESS', 'NETPRO'], async (run) => {
        // Refused before the first write when the realign would take every phase away
        const limits = await findSyncLimits(run, target);
        if (limits.blocks.length > 0) return { blocks: limits.blocks, kept: NO_KEEPS };
        await syncQuantities(run, target);
        await syncArticle(run, target);
        const phases = await syncPhases(run, target);
        await syncPhaseChain(run, target);
        const materials = await syncMaterials(run, target);
        return { blocks: [], kept: { phases, materials } };
    });
    if (blocks.length > 0) return { success: false, error: syncBlockText(blocks) };

    let changes: RowChange[] | null = null;
    try {
        changes = diffSnapshots(before, await snapshotOrder(queryMSSQL, commessa));
    } catch (error) {
        console.error('Riallinea done, but its rows could not be read back for the log:', error);
    }
    return { success: true, commessa, numord: target.numord, netOrdine: target.netOrdine, changes, kept };
}
