/**
 * Data of the DiBa comparison of one order (server only, read queries): the DiBa (Business cicli + movdis), the Business
 * production order (movord H / attivit / assris / movord Y) and the NetPro order (OPERAZIONI / MATERIALI_ORDINI),
 * plus the number of differences and the quantity of the edition in every place (quantityData.ts). See docs/ORDER_PROCESS.md.
 */
import { BUSINESS_COMPANY } from '@/config/constants';
import { queryMSSQL } from '@/lib/mssql';
import { loadOrderArticle } from '@/lib/orders/articleData';
import { compareOrder, countDifferences } from '@/lib/orders/differences';
import { loadDocumentRows, type DocumentRows } from '@/lib/orders/documentRows';
import { loadOrderQuantities } from '@/lib/orders/quantityData';
import { findSyncBlocks } from '@/lib/orders/sync';
import type {
    BusinessOrderOperationRow,
    DibaMaterialRow,
    DibaOperationRow,
    OrderMaterialSummaryRow,
    OrderOperationsManagementData,
    OrderProductionOperationRow,
} from '@/types';

/** The Business production order row (movord tipo H) of one edition */
export interface BusinessOrderRef {
    anno: number;
    numord: number;
    riga: number;
    quant: number;
    serie: string;
    commeca: number;
    codart: string;
    netpid?: string;
    datcons?: string;
}

/** Comparison without data (order not found, or the queries failed) */
export const emptyManagement = (articleFather = ''): OrderOperationsManagementData => ({
    article_father: articleFather,
    ordine_netpro: '',
    diba_operations: [],
    order_operations: [],
    diba_materials: [],
    order_materials: [],
    has_discrepancies: false,
    discrepancy_count: 0,
});

/**
 * Production order row of the edition (or of the commessa's first edition). A Business order can hold several
 * editions (H rows riga 5/10/15...), each with its own NetPro order, phases and materials. With `netpid` it is the
 * row of the commessa that points to that NetPro order: an edition can hold more than one production order
 * (always looked for inside the commessa: `mo_netpid` alone would read the whole table).
 */
async function findBusinessOrder(rootCommessaKey: string, commessaFull?: string, netpid?: string): Promise<BusinessOrderRef | undefined> {
    const movRes = await queryMSSQL<BusinessOrderRef>(`
            SELECT TOP 1
                mo_anno as anno,
                mo_numord as numord,
                mo_riga as riga,
                mo_quant as quant,
                mo_serie as serie,
                mo_commeca as commeca,
                RTRIM(mo_codart) as codart,
                RTRIM(mo_netpid) as netpid,
                CONVERT(VARCHAR(10), mo_datcons, 120) as datcons
            FROM movord WITH (NOLOCK)
            WHERE codditt = '${BUSINESS_COMPANY}' AND mo_tipork = 'H'
              AND ${commessaFull ? 'mo_commeca = @commessaFull' : 'LEFT(CAST(mo_commeca AS VARCHAR(20)), 7) = @rootCommessaKey'}
              ${netpid ? 'AND mo_netpid = @netpid' : ''}
            ORDER BY mo_anno DESC, mo_numord DESC, mo_riga ASC
        `, { ...(commessaFull ? { commessaFull } : { rootCommessaKey }), ...(netpid ? { netpid } : {}) }, 'BUSINESS');
    return movRes.recordset[0];
}

/** Article of the NetPro order, when Business does not give one */
async function findNetproArticle(rootCommessaKey: string): Promise<string | undefined> {
    const ordRes = await queryMSSQL<{ PART_NUMBER: string | null }>(`
                SELECT TOP 1 PART_NUMBER
                FROM ORDINI WITH (NOLOCK)
                WHERE TIPO = 'MAKE' AND LEFT(COMMESSA, 7) = @rootCommessaKey AND PART_NUMBER IS NOT NULL
            `, { rootCommessaKey }, 'NETPRO');
    return ordRes.recordset[0]?.PART_NUMBER || undefined;
}

/** DiBa phases of the article (cicli) */
async function loadDibaOperations(article: string): Promise<DibaOperationRow[]> {
    if (!article) return [];
    const dibaRes = await queryMSSQL<DibaOperationRow>(`
                SELECT
                    dd.dd_riga as riga,
                    dd.dd_fase as fase,
                    dd.dd_codlavo as codlavo,
                    ISNULL(tl.tb_deslavo, '') as descr_lavor,
                    CASE WHEN dd.dd_terzista = 'S' THEN 'Terzista' ELSE 'Lavorazione interna' END as terzista,
                    dd.dd_codcent as codcent,
                    ISNULL(tc.tb_descent, '') as descr_centro,
                    ISNULL(dd.dd_note, '') as note,
                    dd.dd_tempese as tesec,
                    dd.dd_perqta as perqta,
                    dd.dd_aggcp2 as aggriga
                FROM cicli dd WITH (NOLOCK)
                LEFT JOIN tablavo tl WITH (NOLOCK) ON tl.codditt = dd.codditt AND tl.tb_codlavo = dd.dd_codlavo
                LEFT JOIN tabcent tc WITH (NOLOCK) ON tc.codditt = dd.codditt AND tc.tb_codcent = dd.dd_codcent
                WHERE dd.codditt = '${BUSINESS_COMPANY}'
                  AND dd.dd_coddb = @cleanPartNumber
                ORDER BY dd.dd_riga ASC
            `, { cleanPartNumber: article }, 'BUSINESS');
    return dibaRes.recordset;
}

/** DiBa materials of the article (movdis) */
async function loadDibaMaterials(article: string): Promise<DibaMaterialRow[]> {
    if (!article) return [];
    const dibaMatRes = await queryMSSQL<DibaMaterialRow>(`
                SELECT
                    md.md_riga as riga,
                    RTRIM(md.md_codfigli) as codfigli,
                    ISNULL(RTRIM(ar.ar_descr), RTRIM(md.md_codfigli)) as description,
                    md.md_quant as quant,
                    ISNULL(md.md_perpz, 1000) as perpz,
                    RTRIM(md.md_unmis) as unmis
                FROM movdis md WITH (NOLOCK)
                LEFT JOIN artico ar WITH (NOLOCK) ON ar.codditt = md.codditt AND ar.ar_codart = md.md_codfigli
                WHERE md.codditt = '${BUSINESS_COMPANY}' AND md.md_coddb = @cleanPartNumber
                ORDER BY md.md_riga ASC
            `, { cleanPartNumber: article }, 'BUSINESS');
    return dibaMatRes.recordset;
}

/** Phases of the NetPro order: by NetPro id when Business knows it, else by edition, else by commessa root */
async function loadNetproOperations(rootCommessaKey: string, netpid: string, commessaFull?: string): Promise<OrderProductionOperationRow[]> {
    const orderRes = await queryMSSQL<OrderProductionOperationRow>(`
            SELECT
                OPER.ID_OPER as id_oper,
                OPER.ORDINE as ordine,
                OPER.SEQUENZA as sequenza,
                OPER.DESCRIZIONE as descrizione,
                OPER.STATO as stato,
                ISNULL(OPER.CENTRO_ASSEGNATO, '') as centro_assegnato,
                ISNULL(TSK.MACCHINA, '') as machine_code,
                ISNULL(MAC.DESCRIZIONE, '') as machine_name,
                ISNULL(ARE.DESCRIZIONE, 'Unknown') as area_name,
                ISNULL(RTRIM(OPER.DESCRIZIONE01), '') as note
            FROM OPERAZIONI AS OPER WITH (NOLOCK)
            INNER JOIN ORDINI AS ORD WITH (NOLOCK) ON ORD.ORDINE = OPER.ORDINE
            LEFT JOIN JOBSET AS JBS WITH (NOLOCK) ON OPER.ID_OPER = JBS.ID_OPER
            LEFT JOIN TASKS AS TSK WITH (NOLOCK) ON JBS.TASK = TSK.TASK
            LEFT JOIN MACCHINE AS MAC WITH (NOLOCK) ON TSK.MACCHINA = MAC.MACCHINA
            LEFT JOIN CENTRI AS CEN WITH (NOLOCK) ON TSK.MACCHINA = CEN.CENTRO
            LEFT JOIN AREE AS ARE WITH (NOLOCK) ON CEN.AREA = ARE.AREA
            WHERE ORD.TIPO = 'MAKE'
              AND ${netpid ? 'ORD.ORDINE = @netpid' : commessaFull ? 'ORD.COMMESSA = @commessaFull' : 'LEFT(ORD.COMMESSA, 7) = @rootCommessaKey'}
            ORDER BY OPER.ORDINE ASC, OPER.SEQUENZA ASC
        `, netpid ? { netpid } : commessaFull ? { commessaFull } : { rootCommessaKey }, 'NETPRO');
    return orderRes.recordset;
}

/** Materials of the NetPro order (MATERIALI_ORDINI) */
async function loadNetproMaterials(ordineNetpro: string): Promise<OrderMaterialSummaryRow[]> {
    if (!ordineNetpro) return [];
    const netMatRes = await queryMSSQL<OrderMaterialSummaryRow>(`
                SELECT
                    MO.SEQUENZA as riga,
                    RTRIM(MO.PART_NUMBER) as part_number,
                    ISNULL(RTRIM(ANAG.DESCRIZIONE), RTRIM(MO.PART_NUMBER)) as description,
                    ISNULL(MO.QUANTITA, 0) as quant,
                    '' as unmis
                FROM MATERIALI_ORDINI AS MO WITH (NOLOCK)
                LEFT JOIN ANAG_MATERIALI AS ANAG WITH (NOLOCK) ON ANAG.PART_NUMBER = MO.PART_NUMBER
                WHERE MO.ORDINE = @ordine_netpro
                ORDER BY MO.SEQUENZA ASC
            `, { ordine_netpro: ordineNetpro }, 'NETPRO');
    return netMatRes.recordset;
}

/** Phases of the Business production order (attivit + assris) */
async function loadBusinessOperations(order?: BusinessOrderRef): Promise<BusinessOrderOperationRow[]> {
    if (!order) return [];
    const busOpsRes = await queryMSSQL<BusinessOrderOperationRow>(`
                SELECT
                    at.at_fase as fase,
                    at.at_codlavo as codlavo,
                    ISNULL(tl.tb_deslavo, '') as descr_lavor,
                    ISNULL(asr.as_codcent, 0) as codcent,
                    ISNULL(tc.tb_descent, '') as descr_centro,
                    ISNULL(RTRIM(at.at_note), '') as note
                FROM attivit at WITH (NOLOCK)
                LEFT JOIN assris asr WITH (NOLOCK) ON asr.codditt = at.codditt AND asr.as_tipork = at.at_tipork
                    AND asr.as_anno = at.at_anno AND asr.as_numord = at.at_numord
                    AND asr.as_riga = at.at_riga AND asr.as_fase = at.at_fase
                LEFT JOIN tablavo tl WITH (NOLOCK) ON tl.codditt = at.codditt AND tl.tb_codlavo = at.at_codlavo
                LEFT JOIN tabcent tc WITH (NOLOCK) ON tc.codditt = at.codditt AND tc.tb_codcent = asr.as_codcent
                WHERE at.codditt = '${BUSINESS_COMPANY}'
                  AND at.at_tipork = 'H'
                  AND at.at_anno = @anno
                  AND at.at_numord = @numord
                  AND at.at_riga = @riga
                ORDER BY at.at_fase ASC
            `, { anno: order.anno, numord: order.numord, riga: order.riga }, 'BUSINESS');
    return busOpsRes.recordset;
}

/** Materials of the Business production order (movord tipo Y under the H row) */
async function loadBusinessMaterials(order?: BusinessOrderRef): Promise<OrderMaterialSummaryRow[]> {
    if (!order) return [];
    const busMatRes = await queryMSSQL<OrderMaterialSummaryRow>(`
                SELECT
                    mo_riga as riga,
                    RTRIM(mo_codart) as part_number,
                    RTRIM(mo_descr) as description,
                    mo_quant as quant,
                    RTRIM(mo_unmis) as unmis
                FROM movord WITH (NOLOCK)
                WHERE codditt = '${BUSINESS_COMPANY}'
                  AND mo_tipork = 'Y'
                  AND mo_anno = @anno
                  AND mo_numord = @numord
                  AND mo_rigaor = @riga
                ORDER BY mo_riga ASC
            `, { anno: order.anno, numord: order.numord, riga: order.riga }, 'BUSINESS');
    return busMatRes.recordset;
}

/** The comparison of one edition (or of the commessa's first edition) with its DiBa; a failed read throws */
export async function loadOrderManagement(
    rootCommessaKey: string,
    articleHint?: string,
    /** Full commessa of one edition (e.g. 260960410): scopes everything to that edition */
    commessaFull?: string,
    /** One NetPro production order: scopes everything to it and to the Business order that points to it */
    netpid?: string
): Promise<OrderOperationsManagementData> {
    const order = await findBusinessOrder(rootCommessaKey, commessaFull, netpid);
    // The edition's own article wins over the hint (editions can have different articles)
    let article = (!articleHint || commessaFull) && order ? order.codart : articleHint;
    if (!article) article = await findNetproArticle(rootCommessaKey);
    article = (article || '').trim();

    // The independent reads run together
    const [dibaOperations, dibaMaterials, orderOperations, businessOperations, businessMaterials] = await Promise.all([
        loadDibaOperations(article),
        loadDibaMaterials(article),
        loadNetproOperations(rootCommessaKey, netpid || order?.netpid || '', commessaFull),
        loadBusinessOperations(order),
        loadBusinessMaterials(order),
    ]);
    const ordineNetpro = orderOperations[0]?.ordine ?? '';
    // The impegno cliente and order rows feed the Quantità and Articolo tabs
    const netproMake = order?.netpid || ordineNetpro;
    const documents: DocumentRows = order ? await loadDocumentRows(order) : {};
    const [netproMaterials, quantities, articleFacts, blocks] = await Promise.all([
        loadNetproMaterials(ordineNetpro),
        loadOrderQuantities(documents, order, netproMake),
        loadOrderArticle(documents, order, netproMake),
        // What Riallinea itself asks before it writes, so the list and the order page say it before the button is pressed
        order && netproMake ? findSyncBlocks(queryMSSQL, { articleFather: article, anno: order.anno, numord: order.numord, rigaPadre: order.riga, netOrdine: netproMake }) : [],
    ]);

    const data: OrderOperationsManagementData = {
        article_father: article,
        ordine_netpro: ordineNetpro,
        commessa_full: order ? String(order.commeca) : undefined,
        order_bus_numord: order?.numord,
        order_bus_anno: order?.anno,
        order_bus_riga: order?.riga,
        order_father_quant: order?.quant,
        impegno_anno: documents.impegno?.anno,
        impegno_numord: documents.impegno?.numord,
        diba_operations: dibaOperations,
        order_operations: orderOperations,
        business_operations: businessOperations,
        diba_materials: dibaMaterials,
        order_materials: businessMaterials,
        netpro_materials: netproMaterials,
        quantities,
        article: articleFacts,
        sync_blocks: blocks,
    };
    // Differences: DiBa (truth) vs Business order vs NetPro order, plus the quantities and the article data (impegno
    // cliente as truth), counted with the comparisons the tabs show, so Riallinea shows up when only one of those differs
    const discrepancyCount = countDifferences(compareOrder(data));
    return { ...data, has_discrepancies: discrepancyCount > 0, discrepancy_count: discrepancyCount };
}

/**
 * The same for the order page: read errors give an empty comparison (logged), so the rest of the page still shows.
 */
export async function fetchOrderManagement(rootCommessaKey: string, articleHint?: string, commessaFull?: string): Promise<OrderOperationsManagementData> {
    try {
        return await loadOrderManagement(rootCommessaKey, articleHint, commessaFull);
    } catch (err) {
        console.error('Error in fetchOrderManagement:', err);
        return emptyManagement(articleHint);
    }
}
