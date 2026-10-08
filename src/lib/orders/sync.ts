/**
 * "Riallinea": rewrites the Business and NetPro production order of a commessa in place from its DiBa (the truth),
 * keeping the order ids. WRITES to both production databases; see docs/ORDER_PROCESS.md.
 *
 * - Business: attivit, assris, movord (tipo Y), keyord
 * - NetPro: OPERAZIONI, TASKS, JOBSET, MATERIALI_ORDINI
 * artpro is intentionally left untouched (NetPro handles it when the order is completed).
 * Only single-edition commesse are supported: with more editions the statements could touch the wrong order.
 */
import { APP_CONFIG, BUSINESS_COMPANY } from '@/config/constants';
import { queryMSSQL } from '@/lib/mssql';
import { dibaMaterialQty, isPlaceholderMaterial } from '@/lib/orders/compare';
import { rowExists } from '@/lib/orders/sql';
import { buildBusinessOverrides, buildNetProOverrides, cloneRowInsert, netOperId, NOW } from '@/lib/orders/syncRows';
import { APP_COPY, fmt } from '@/locales';
import type { DibaMaterialRow, DibaOperationRow } from '@/types';

const copy = APP_COPY.analytics.orderOperations;

/** The order being realigned */
interface SyncTarget {
    articleFather: string;
    /** Copies of the order: phase and material quantities follow it */
    orderFatherQuant: number;
    anno: number;
    numord: number;
    /** Row of the H line in movord */
    rigaPadre: number;
    /** NetPro order id */
    netOrdine: string;
}

/** A material row of the Business order (movord tipo Y) */
interface BusinessMaterialRow {
    mo_riga: number;
    codart: string;
    mo_quant: number;
    descr: string;
    unmis: string;
    disbasriga: number;
}

type SyncResult = { success: true } | { success: false; error: string };

/** Finds the Business H row and the NetPro order of the commessa; refuses commesse with more editions */
async function findTarget(rootCommessaKey: string, articleFatherHint?: string): Promise<SyncTarget | string> {
    const busOrderRes = await queryMSSQL(`
            SELECT TOP 1
                mo_anno, mo_serie, mo_numord, mo_riga, mo_codart, mo_quant, mo_commeca, mo_datcons
            FROM movord WITH (NOLOCK)
            WHERE codditt = '${BUSINESS_COMPANY}'
              AND mo_tipork = 'H'
              AND LEFT(CAST(mo_commeca AS VARCHAR(20)), 7) = @rootCommessaKey
            ORDER BY mo_anno DESC, mo_numord DESC
        `, { rootCommessaKey }, 'BUSINESS');

    if (busOrderRes.recordset.length === 0) return copy.syncNoOrder;

    // SAFETY GUARD: not edition-aware yet. With more than one edition (H rows) or more than one NetPro MAKE order
    // it could pick the wrong order, and its attivit/assris statements are not filtered by edition.
    const editionCheck = await queryMSSQL<{ n: number }>(`
            SELECT COUNT(*) AS n FROM movord WITH (NOLOCK)
            WHERE codditt = '${BUSINESS_COMPANY}' AND mo_tipork = 'H'
              AND LEFT(CAST(mo_commeca AS VARCHAR(20)), 7) = @rootCommessaKey
        `, { rootCommessaKey }, 'BUSINESS');
    const netOrderCheck = await queryMSSQL<{ n: number }>(`
            SELECT COUNT(*) AS n FROM ORDINI WITH (NOLOCK)
            WHERE TIPO = 'MAKE' AND LEFT(COMMESSA, 7) = @rootCommessaKey
        `, { rootCommessaKey }, 'NETPRO');
    const business = editionCheck.recordset[0].n;
    const netpro = netOrderCheck.recordset[0].n;
    if (business > 1 || netpro > 1) return fmt(copy.syncMultiEdition, { business, netpro });

    const busOrder = busOrderRes.recordset[0];
    const anno = busOrder.mo_anno;
    const numord = busOrder.mo_numord;
    const rigaPadre = busOrder.mo_riga;

    const netOrderRes = await queryMSSQL(`
            SELECT TOP 1 ORDINE, PART_NUMBER
            FROM ORDINI WITH (NOLOCK)
            WHERE TIPO = 'MAKE' AND LEFT(COMMESSA, 7) = @rootCommessaKey
            ORDER BY ORDINE DESC
        `, { rootCommessaKey }, 'NETPRO');

    return {
        articleFather: (articleFatherHint || busOrder.mo_codart).trim(),
        orderFatherQuant: Number(busOrder.mo_quant) || APP_CONFIG.ORDERS.DEFAULT_QUANTITY,
        anno,
        numord,
        rigaPadre,
        netOrdine:
            netOrderRes.recordset.length > 0
                ? netOrderRes.recordset[0].ORDINE
                : `H${String(anno).substring(2)} ${String(numord).padStart(9, '0')}${String(rigaPadre).padStart(4, '0')}`,
    };
}

/** Phases: removes those not in the DiBa, adds the missing ones, refreshes the others */
async function syncPhases({ articleFather, orderFatherQuant, anno, numord, netOrdine }: SyncTarget) {
    const dibaOpsRes = await queryMSSQL<DibaOperationRow>(`
            SELECT
                dd.dd_riga as riga,
                dd.dd_fase as fase,
                dd.dd_codlavo as codlavo,
                ISNULL(tl.tb_deslavo, '') as descr_lavor,
                CASE WHEN dd.dd_terzista = 'S' THEN 'S' ELSE 'N' END as terzista,
                dd.dd_codcent as codcent,
                ISNULL(tc.tb_descent, '') as descr_centro,
                ISNULL(dd.dd_note, '') as note,
                dd.dd_tempese as tesec,
                dd.dd_perqta as perqta
            FROM cicli dd WITH (NOLOCK)
            LEFT JOIN tablavo tl WITH (NOLOCK) ON tl.codditt = dd.codditt AND tl.tb_codlavo = dd.dd_codlavo
            LEFT JOIN tabcent tc WITH (NOLOCK) ON tc.codditt = dd.codditt AND tc.tb_codcent = dd.dd_codcent
            WHERE dd.codditt = '${BUSINESS_COMPANY}'
              AND dd.dd_coddb = @articleFather
            ORDER BY dd.dd_fase ASC
        `, { articleFather }, 'BUSINESS');
    const dibaOps = dibaOpsRes.recordset;

    const netOpsRes = await queryMSSQL<{ ID_OPER: string; SEQUENZA: number; DESCRIZIONE: string }>(`
            SELECT ID_OPER, SEQUENZA, DESCRIZIONE
            FROM OPERAZIONI WITH (NOLOCK)
            WHERE ORDINE = @netOrdine
            ORDER BY SEQUENZA ASC
        `, { netOrdine }, 'NETPRO');
    const netOps = netOpsRes.recordset;

    const dibaFasi = new Set(dibaOps.map((o) => o.fase));
    const netFasi = new Set(netOps.map((o) => o.SEQUENZA));

    // In the order but not in the DiBa: removed from both databases
    for (const op of netOps.filter((o) => !dibaFasi.has(o.SEQUENZA))) {
        await queryMSSQL(`DELETE FROM JOBSET WHERE ID_OPER = @id_oper`, { id_oper: op.ID_OPER }, 'NETPRO');
        await queryMSSQL(`DELETE FROM TASKS WHERE TASK = @id_oper`, { id_oper: op.ID_OPER }, 'NETPRO');
        await queryMSSQL(`DELETE FROM OPERAZIONI WHERE ID_OPER = @id_oper`, { id_oper: op.ID_OPER }, 'NETPRO');
        await queryMSSQL(`
                DELETE FROM assris WHERE codditt = '${BUSINESS_COMPANY}' AND as_numord = @numord AND as_anno = @anno AND as_fase = @fase
            `, { numord, anno, fase: op.SEQUENZA }, 'BUSINESS');
        await queryMSSQL(`
                DELETE FROM attivit WHERE codditt = '${BUSINESS_COMPANY}' AND at_numord = @numord AND at_anno = @anno AND at_fase = @fase
            `, { numord, anno, fase: op.SEQUENZA }, 'BUSINESS');
    }

    // In the DiBa but not in the order: rows cloned from existing rows of this order, unless already there
    for (const op of dibaOps.filter((o) => !netFasi.has(o.fase))) {
        const ov = buildNetProOverrides(op, netOrdine, orderFatherQuant, NOW);
        const bv = buildBusinessOverrides(op, orderFatherQuant);

        if (!(await rowExists('OPERAZIONI', 'ID_OPER = @id', { id: ov.idOper }, 'NETPRO'))) {
            await cloneRowInsert('NETPRO', 'OPERAZIONI', 'ORDINE = @netOrdine', { netOrdine }, ov.OPERAZIONI);
        }
        if (!(await rowExists('TASKS', 'TASK = @id', { id: ov.idOper }, 'NETPRO'))) {
            await cloneRowInsert('NETPRO', 'TASKS', 'TASK IN (SELECT TASK FROM JOBSET WHERE ORDINE = @netOrdine)', { netOrdine }, ov.TASKS);
        }
        if (!(await rowExists('JOBSET', 'ID_OPER = @id AND TASK = @id', { id: ov.idOper }, 'NETPRO'))) {
            await cloneRowInsert('NETPRO', 'JOBSET', 'ORDINE = @netOrdine', { netOrdine }, ov.JOBSET);
        }
        if (!(await rowExists('attivit', `codditt = '${BUSINESS_COMPANY}' AND at_numord = @numord AND at_anno = @anno AND at_fase = @fase`, { numord, anno, fase: op.fase }, 'BUSINESS'))) {
            await cloneRowInsert('BUSINESS', 'attivit', `codditt = '${BUSINESS_COMPANY}' AND at_numord = @numord AND at_anno = @anno`, { numord, anno }, bv.attivit);
        }
        if (!(await rowExists('assris', `codditt = '${BUSINESS_COMPANY}' AND as_numord = @numord AND as_anno = @anno AND as_fase = @fase`, { numord, anno, fase: op.fase }, 'BUSINESS'))) {
            await cloneRowInsert('BUSINESS', 'assris', `codditt = '${BUSINESS_COMPANY}' AND as_numord = @numord AND as_anno = @anno`, { numord, anno }, bv.assris);
        }
    }

    // In both: every field that can change is taken again from the DiBa
    for (const op of dibaOps.filter((o) => netFasi.has(o.fase))) {
        const idOper = netOperId(netOrdine, op.fase);

        // Business attivit — work type, planned time (sec), planned qty, terzista, notes
        await queryMSSQL(`
                UPDATE attivit
                SET at_codlavo    = @codlavo,
                    at_tempesepr  = @tesec,
                    at_qtapr      = @orderFatherQuant,
                    at_terzista   = @terzista,
                    at_note       = @note
                WHERE codditt = '${BUSINESS_COMPANY}'
                  AND at_numord = @numord
                  AND at_anno   = @anno
                  AND at_fase   = @fase
            `, { codlavo: op.codlavo, tesec: op.tesec, orderFatherQuant, terzista: op.terzista, note: op.note || null, numord, anno, fase: op.fase }, 'BUSINESS');

        // Business assris — work center
        await queryMSSQL(`
                UPDATE assris
                SET as_codcent = @codcent
                WHERE codditt = '${BUSINESS_COMPANY}'
                  AND as_numord = @numord
                  AND as_anno   = @anno
                  AND as_fase   = @fase
            `, { codcent: op.codcent, numord, anno, fase: op.fase }, 'BUSINESS');

        // NetPro OPERAZIONI — description, work centers (real centre only if not manually reassigned), qty
        await queryMSSQL(`
                UPDATE OPERAZIONI
                SET DESCRIZIONE      = @descr,
                    DESCRIZIONE01    = @note,
                    CENTRO_REALE     = CASE WHEN CENTRO_REALE = CENTRO_ASSEGNATO THEN @centro ELSE CENTRO_REALE END,
                    CENTRO_ASSEGNATO = @centro,
                    T_LAVORO_MAC     = @tesec,
                    QTA_RICHIESTA    = @orderFatherQuant
                WHERE ID_OPER = @idOper
            `, { descr: op.descr_lavor, centro: String(op.codcent), tesec: op.tesec, note: op.note ? op.note.slice(0, 100) : null, orderFatherQuant, idOper }, 'NETPRO');

        // NetPro TASKS — description, machine, notes, qty
        await queryMSSQL(`
                UPDATE TASKS
                SET DESCRIZIONE        = @descr,
                    MACCHINA_ASSEGNATA = CASE WHEN MACCHINA_ASSEGNATA = MACCHINA THEN @centro ELSE MACCHINA_ASSEGNATA END,
                    MACCHINA           = @centro,
                    QTA_RICHIESTA      = @orderFatherQuant
                WHERE TASK = @idOper
            `, { descr: op.descr_lavor, centro: String(op.codcent), orderFatherQuant, idOper }, 'NETPRO');

        // NetPro JOBSET — qty
        await queryMSSQL(`UPDATE JOBSET SET QTA_RICHIESTA = @orderFatherQuant WHERE ID_OPER = @idOper`,
            { orderFatherQuant, idOper }, 'NETPRO');
    }
}

/** Phase chain: NetPro CENTRO_SUCCESSIVO and Business at_sufase point to the next phase */
async function syncPhaseChain({ anno, numord, rigaPadre, netOrdine }: SyncTarget) {
    const chainRes = await queryMSSQL<{ ID_OPER: string; SEQUENZA: number; CENTRO_ASSEGNATO: string; CENTRO_SUCCESSIVO: string | null }>(`
            SELECT ID_OPER, SEQUENZA, CENTRO_ASSEGNATO, CENTRO_SUCCESSIVO
            FROM OPERAZIONI WITH (NOLOCK) WHERE ORDINE = @netOrdine ORDER BY SEQUENZA ASC
        `, { netOrdine }, 'NETPRO');
    const chainOps = chainRes.recordset;
    for (let i = 0; i < chainOps.length; i++) {
        const next = chainOps[i + 1];
        const wantCentro = next ? String(next.CENTRO_ASSEGNATO) : null;
        if ((chainOps[i].CENTRO_SUCCESSIVO ?? null) !== wantCentro) {
            await queryMSSQL(`UPDATE OPERAZIONI SET CENTRO_SUCCESSIVO = @c WHERE ID_OPER = @id`,
                { c: wantCentro, id: chainOps[i].ID_OPER }, 'NETPRO');
        }
        await queryMSSQL(`
                UPDATE attivit
                SET at_sufase = @next, at_suanno = @suanno, at_sunumord = @sunumord, at_suriga = @suriga
                WHERE codditt = '${BUSINESS_COMPANY}' AND at_numord = @numord AND at_anno = @anno AND at_fase = @fase
            `, {
            next: next ? next.SEQUENZA : 0,
            suanno: next ? anno : 0, sunumord: next ? numord : 0, suriga: next ? rigaPadre : 0,
            numord, anno, fase: chainOps[i].SEQUENZA,
        }, 'BUSINESS');
    }
}

/**
 * Materials: rows linked like the official process — Business Y row ↔ DiBa row via mo_disbasriga = md_riga,
 * NetPro row ↔ Business row via MATERIALI_ORDINI.SEQUENZA = mo_riga (a DiBa can list the same code twice).
 * The MP_FITTIZIA placeholder is never added, updated or removed.
 */
async function syncMaterials({ articleFather, orderFatherQuant, anno, numord, rigaPadre, netOrdine }: SyncTarget) {
    const dibaMatRes = await queryMSSQL<DibaMaterialRow>(`
            SELECT
                md.md_riga as riga,
                RTRIM(md.md_codfigli) as codfigli,
                ISNULL(RTRIM(ar.ar_descr), RTRIM(md.md_codfigli)) as description,
                RTRIM(ar.ar_desint) as desint,
                md.md_quant as quant,
                ISNULL(md.md_perpz, 1000) as perpz,
                RTRIM(md.md_unmis) as unmis
            FROM movdis md WITH (NOLOCK)
            LEFT JOIN artico ar WITH (NOLOCK) ON ar.codditt = md.codditt AND ar.ar_codart = md.md_codfigli
            WHERE md.codditt = '${BUSINESS_COMPANY}' AND md.md_coddb = @articleFather
            ORDER BY md.md_riga ASC
        `, { articleFather }, 'BUSINESS');
    const dibaMat = dibaMatRes.recordset.filter((m) => !isPlaceholderMaterial(m.codfigli));

    const busMatRes = await queryMSSQL<BusinessMaterialRow>(`
            SELECT
                mo_riga, RTRIM(mo_codart) as codart, mo_quant, RTRIM(mo_descr) as descr, RTRIM(mo_unmis) as unmis,
                mo_disbasriga as disbasriga
            FROM movord WITH (NOLOCK)
            WHERE codditt = '${BUSINESS_COMPANY}' AND mo_numord = @numord AND mo_anno = @anno AND mo_tipork = 'Y'
              AND mo_rigaor = @rigaPadre
            ORDER BY mo_riga ASC
        `, { numord, anno, rigaPadre }, 'BUSINESS');
    const busMat = busMatRes.recordset.filter((m) => !isPlaceholderMaterial(m.codart));

    const dibaByRiga = new Map<number, DibaMaterialRow>(dibaMat.map((m) => [Number(m.riga), m]));
    const busByDibaRiga = new Map<number, BusinessMaterialRow>();
    // Row numbers are taken over ALL order rows (incl. MP_FITTIZIA) so a new row never reuses one
    let maxRiga = 0;
    for (const m of busMatRes.recordset) if (m.mo_riga > maxRiga) maxRiga = m.mo_riga;
    for (const m of busMat) {
        if (m.mo_riga > maxRiga) maxRiga = m.mo_riga;
        busByDibaRiga.set(Number(m.disbasriga), m);
    }

    // Order rows whose DiBa row is gone or now holds a different code are removed
    for (const m of busMat) {
        const dm = dibaByRiga.get(Number(m.disbasriga));
        if (dm && dm.codfigli === m.codart && busByDibaRiga.get(Number(m.disbasriga)) === m) continue;

        await queryMSSQL(`
                DELETE FROM keyord
                WHERE codditt = '${BUSINESS_COMPANY}' AND ko_numord = @numord AND ko_anno = @anno AND ko_tipork = 'Y' AND ko_riga = @riga
            `, { numord, anno, riga: m.mo_riga }, 'BUSINESS');

        await queryMSSQL(`
                DELETE FROM movord
                WHERE codditt = '${BUSINESS_COMPANY}' AND mo_numord = @numord AND mo_anno = @anno AND mo_tipork = 'Y' AND mo_riga = @riga
            `, { numord, anno, riga: m.mo_riga }, 'BUSINESS');

        await queryMSSQL(`
                DELETE FROM MATERIALI_ORDINI
                WHERE ORDINE = @netOrdine AND SEQUENZA = @riga
            `, { netOrdine, riga: m.mo_riga }, 'NETPRO');

        if (busByDibaRiga.get(Number(m.disbasriga)) === m) busByDibaRiga.delete(Number(m.disbasriga));
    }

    // DiBa materials: quantity updated when the row exists, new rows added otherwise
    for (const dm of dibaMat) {
        const expectedQuant = dibaMaterialQty(orderFatherQuant, dm.quant, dm.perpz);
        // NetPro QTA_IMPIEGO = quantity per produced piece (e.g. 1200 / 1358)
        const qtaImpiego = orderFatherQuant ? expectedQuant / orderFatherQuant : 0;
        const existing = busByDibaRiga.get(Number(dm.riga));

        if (existing && existing.codart === dm.codfigli) {
            const riga = existing.mo_riga;
            await queryMSSQL(`
                    UPDATE movord
                    SET mo_quant = @expectedQuant, mo_colli = @expectedQuant, mo_ultagg = GETDATE()
                    WHERE codditt = '${BUSINESS_COMPANY}' AND mo_numord = @numord AND mo_anno = @anno AND mo_tipork = 'Y' AND mo_riga = @riga
                `, { expectedQuant, numord, anno, riga }, 'BUSINESS');

            await queryMSSQL(`
                    UPDATE MATERIALI_ORDINI
                    SET QUANTITA = @expectedQuant, QTA_IMPIEGO = @qtaImpiego
                    WHERE ORDINE = @netOrdine AND SEQUENZA = @riga
                `, { expectedQuant, qtaImpiego, netOrdine, riga }, 'NETPRO');
        } else {
            maxRiga += 5;
            const newRiga = maxRiga;

            const tplParams = { anno, numord };
            const busTpl = `codditt = '${BUSINESS_COMPANY}' AND mo_anno = @anno AND mo_numord = @numord AND mo_tipork = 'Y'`;
            // Business movord (cloned from an existing material row of this order; price fields not recalculated)
            await cloneRowInsert('BUSINESS', 'movord', busTpl, tplParams, {
                mo_riga: newRiga, mo_codart: dm.codfigli, mo_unmis: dm.unmis || 'Nr', mo_ump: dm.unmis || 'Nr',
                mo_descr: dm.description, mo_colli: expectedQuant, mo_quant: expectedQuant, mo_coleva: 0, mo_quaeva: 0,
                mo_prezzo: 0, mo_valore: 0, mo_valoremm: 0, mo_desint: dm.desint || null, mo_stasino: 'N',
                mo_disbasriga: dm.riga, mo_ultagg: NOW,
            });
            // Business keyord (ko_conto etc. copied from the order's existing rows)
            await cloneRowInsert('BUSINESS', 'keyord',
                `codditt = '${BUSINESS_COMPANY}' AND ko_anno = @anno AND ko_numord = @numord AND ko_tipork = 'Y'`, tplParams,
                { ko_riga: newRiga, ko_codart: dm.codfigli });
            // NetPro MATERIALI_ORDINI (cloned from an existing row of this order)
            await cloneRowInsert('NETPRO', 'MATERIALI_ORDINI', 'ORDINE = @netOrdine', { netOrdine }, {
                SEQUENZA: newRiga, PART_NUMBER: dm.codfigli, QUANTITA: expectedQuant, QTA_IMPIEGO: qtaImpiego,
            });
        }
    }
}

/** Realigns the order of the commessa to its DiBa: phases, phase chain, materials (in this order) */
export async function syncOrderFromDiba(rootCommessaKey: string, articleFatherHint?: string): Promise<SyncResult> {
    const target = await findTarget(rootCommessaKey, articleFatherHint);
    if (typeof target === 'string') return { success: false, error: target };

    await syncPhases(target);
    await syncPhaseChain(target);
    await syncMaterials(target);
    return { success: true };
}
