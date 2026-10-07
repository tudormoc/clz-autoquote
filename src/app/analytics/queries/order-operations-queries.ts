/**
 * ORDER OPERATIONS QUERIES
 * 
 * Track operations progress for individual orders.
 * Shows what operations have been done and what's still pending.
 * 
 * DATA SOURCE: NETPRO database only
 * - OPERAZIONI: Operation details and status
 * - ORDINI: Order information
 * - TASKS: Task quantities
 * - JOBSET: Links operations to tasks
 * - MACCHINE: Machine names
 */

'use server'

import { queryMSSQL } from '@/lib/mssql';
import { buildNetProOverrides, buildBusinessOverrides, cloneRowInsert, NOW } from '@/lib/orderSync';
import { compareOperations, compareMaterials, countDiscrepancies, dibaMaterialQty, isPlaceholderMaterial } from '@/lib/orderCompare';
import { 
    DibaOperationRow,
    BusinessOrderOperationRow,
    DibaMaterialRow,
    OrderMaterialSummaryRow,
    OrderProductionOperationRow,
    OrderOperationsManagementData
} from '@/types';

/**
 * ============================================================================
 * ORDER OPERATIONS TRACKER
 * ============================================================================
 * 
 * Shows all operations for a specific order with their status.
 * Groups operations by sequence + machine when multiple editions exist.
 * 
 * STATUS VALUES:
 * - EXE: In work (operation is currently being executed)
 * - SUS: Suspended (started but paused or done)
 * - COM: Completed (operation is closed)
 * 
 * STATUS PRIORITY (when grouping editions):
 * - If ANY edition is EXE → show EXE
 * - Else if ANY edition is SUS → show SUS
 * - Else if ALL editions are COM → show COM
 * - Else → Not Started
 * 
 * SEARCH:
 * - By 4-digit commessa code (fuzzy match)
 * - By order description (fuzzy match)
 * 
 * SORTING: By operation sequence (SEQUENZA)
 * ============================================================================
 */
export interface MasterOrderMatch {
    root_commessa_key: string;
    commessa_display: string;
    year_code: string;
    master_order_title: string;
    client_name: string;
    edition_count: number;
}

export interface Material {
    part_number: string;
    description: string;
    unit_of_measure: string;
    material_class: string;
    total_quantity: number;
    picked_quantity: number;
    used_quantity: number;
    stock_quantity: number;
    order_count: number;
}

/**
 * Fetch editions, operations, and materials for a specific master order key (e.g. '2609493')
 */
async function fetchOrderDetailsByKey(rootCommessaKey: string) {
    const busDb = process.env.MSSQL_DATABASE_BUSINESS || 'COOPZANARDI';

    // Independent queries run in parallel
    const editionsQuery = queryMSSQL(`
        SELECT 
            SUBSTRING(ORD.COMMESSA, 4, 4) as commessa_display,
            ORD.COMMESSA as commessa_full,
            MAX(ORD.ORDINE) as ordine,
            MAX(ORD.PART_NUMBER) as part_number,
            MAX(ORD.DESCRIZIONE) as order_description,
            ISNULL(MAX(COM.co_descr1), '') as master_order_title,
            ISNULL(MAX(CCA.descr), '') as client_name
        FROM ORDINI AS ORD WITH (NOLOCK)
        LEFT JOIN ${busDb}.dbo.COMMESS AS COM WITH (NOLOCK) ON TRY_CAST(ORD.COMMESSA AS BIGINT) = COM.co_comme
        LEFT JOIN cliente_commessa_attivita AS CCA WITH (NOLOCK) ON ORD.COMMESSA = CCA.commessa
        WHERE ORD.TIPO = 'MAKE'
          AND LEFT(ORD.COMMESSA, 7) = @rootCommessaKey
        GROUP BY ORD.COMMESSA, SUBSTRING(ORD.COMMESSA, 4, 4)
        ORDER BY ORD.COMMESSA ASC
    `, { rootCommessaKey }, 'NETPRO');

    // DiBa notes are first copied into a table variable: joining View_Note_Diba directly made
    // SQL Server pick a very slow plan (0.5-2.5s); this returns identical rows in ~0.15s.
    const operationsQuery = queryMSSQL(`
        DECLARE @notes TABLE (netpid NVARCHAR(100), fase INT, dd_note NVARCHAR(MAX));
        INSERT INTO @notes (netpid, fase, dd_note)
        SELECT mo_netpid, at_fase, dd_note FROM View_Note_Diba WITH (NOLOCK)
        WHERE mo_netpid IN (SELECT ORDINE FROM ORDINI WITH (NOLOCK) WHERE TIPO = 'MAKE' AND LEFT(COMMESSA, 7) = @rootCommessaKey);

        SELECT 
            TSK.MACCHINA as machine_code,
            MAC.DESCRIZIONE as machine_name,
            OPER.DESCRIZIONE as operation_name,
            ISNULL(MAX(NULLIF(RTRIM(VND.dd_note), '')), '') as diba_note,
            ISNULL(ARE.DESCRIZIONE, 'Unknown') as area_name,
            -- Status priority: EXE > SUS > COM
            CASE 
                WHEN MAX(CASE WHEN OPER.STATO = 'EXE' THEN 1 ELSE 0 END) = 1 THEN 'EXE'
                WHEN MAX(CASE WHEN OPER.STATO = 'SUS' THEN 1 ELSE 0 END) = 1 THEN 'SUS'
                WHEN MIN(CASE WHEN OPER.STATO = 'COM' THEN 1 ELSE 0 END) = 1 THEN 'COM'
                ELSE 'PENDING'
            END as status,
            COUNT(DISTINCT ORD.COMMESSA) as edition_count
        FROM OPERAZIONI AS OPER WITH (NOLOCK)
        INNER JOIN JOBSET AS JBS WITH (NOLOCK) ON OPER.ID_OPER = JBS.ID_OPER 
        INNER JOIN TASKS AS TSK WITH (NOLOCK) ON JBS.TASK = TSK.TASK 
        INNER JOIN ORDINI AS ORD WITH (NOLOCK) ON ORD.ORDINE = OPER.ORDINE
        INNER JOIN MACCHINE AS MAC WITH (NOLOCK) ON TSK.MACCHINA = MAC.MACCHINA
        LEFT JOIN CENTRI AS CEN WITH (NOLOCK) ON TSK.MACCHINA = CEN.CENTRO
        LEFT JOIN AREE AS ARE WITH (NOLOCK) ON CEN.AREA = ARE.AREA
        LEFT JOIN @notes AS VND ON OPER.ORDINE = VND.netpid AND OPER.SEQUENZA = VND.fase
        WHERE ORD.TIPO = 'MAKE'
          AND LEFT(ORD.COMMESSA, 7) = @rootCommessaKey
          AND (
            VND.dd_note IS NULL 
            OR (
              RTRIM(VND.dd_note) != 'NO'
              AND VND.dd_note NOT LIKE 'NO %'
              AND VND.dd_note NOT LIKE 'NO-%'
            )
          )
        GROUP BY TSK.MACCHINA, MAC.DESCRIZIONE, OPER.DESCRIZIONE, ARE.DESCRIZIONE
    `, { rootCommessaKey }, 'NETPRO');

    const materialsQuery = queryMSSQL(`
        WITH ActiveOrders AS (
            SELECT MAX(ORDINE) as ordine 
            FROM ORDINI WITH (NOLOCK) 
            WHERE TIPO = 'MAKE' AND LEFT(COMMESSA, 7) = @rootCommessaKey 
            GROUP BY COMMESSA
        )
        SELECT 
            MO.PART_NUMBER as part_number,
            ISNULL(MAX(ANAG.DESCRIZIONE), MO.PART_NUMBER) as description,
            ISNULL(MAX(ANAG.UNITA_MISURA), '') as unit_of_measure,
            ISNULL(MAX(ANAG.CLASSE), 'Materiale') as material_class,
            SUM(MO.QUANTITA) as total_quantity,
            SUM(MO.QTA_PRELEVATA) as picked_quantity,
            SUM(MO.QTA_USATA) as used_quantity,
            ISNULL(MAX(ANAG.GIACENZA), 0) as stock_quantity,
            COUNT(DISTINCT MO.ORDINE) as order_count
        FROM MATERIALI_ORDINI AS MO WITH (NOLOCK)
        INNER JOIN ActiveOrders AS AO ON MO.ORDINE = AO.ordine
        LEFT JOIN ANAG_MATERIALI AS ANAG WITH (NOLOCK) ON MO.PART_NUMBER = ANAG.PART_NUMBER
        WHERE MO.PART_NUMBER != 'MP_FITTIZIA'
        GROUP BY MO.PART_NUMBER
        ORDER BY MAX(ANAG.CLASSE), MO.PART_NUMBER
    `, { rootCommessaKey }, 'NETPRO');

    const [editionsResult, result, materialsResult] = await Promise.all([editionsQuery, operationsQuery, materialsQuery]);

    const operationsManagement = await fetchOrderOperationsManagement(
        rootCommessaKey,
        editionsResult.recordset.length > 0 ? editionsResult.recordset[0].part_number : undefined
    );

    return {
        editions: editionsResult.recordset,
        data: result.recordset,
        materials: materialsResult.recordset as Material[],
        operationsManagement
    };

}


/**
 * Fetch operations management data:
 * 1. Distinta Base (cicli from BUSINESS DB)
 * 2. Ordine di Produzione (OPERAZIONI from NETPRO DB)
 */
async function fetchOrderOperationsManagement(
    rootCommessaKey: string,
    partNumberHint?: string,
    /** Full commessa of one edition (e.g. 260960410): scopes everything to that edition */
    commessaFull?: string
): Promise<OrderOperationsManagementData> {
    try {
        let partNumber = partNumberHint;
        let orderBusInfo: {
            anno: number;
            numord: number;
            riga: number;
            quant: number;
            serie: string;
            commeca: number;
            codart: string;
            netpid?: string;
            datcons?: string;
        } | null = null;

        // Fetch parent production order row (Tipo 'H') = one edition. A Business order can hold
        // several editions (H rows riga 5/10/15...), each with its own NetPro order, phases and materials.
        const movRes = await queryMSSQL(`
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
            WHERE codditt = 'COOPZANARDI' AND mo_tipork = 'H'
              AND ${commessaFull ? 'mo_commeca = @commessaFull' : 'LEFT(CAST(mo_commeca AS VARCHAR(20)), 7) = @rootCommessaKey'}
            ORDER BY mo_anno DESC, mo_numord DESC, mo_riga ASC
        `, commessaFull ? { commessaFull } : { rootCommessaKey }, 'BUSINESS');

        if (movRes.recordset.length > 0) {
            orderBusInfo = movRes.recordset[0];
            // The edition's own article wins over the hint (editions can have different articles)
            if (!partNumber || commessaFull) {
                partNumber = movRes.recordset[0].codart;
            }
        }
        const netpid = orderBusInfo?.netpid || '';

        // If partNumber not provided, find it from NETPRO ORDINI
        if (!partNumber) {
            const ordRes = await queryMSSQL(`
                SELECT TOP 1 PART_NUMBER 
                FROM ORDINI WITH (NOLOCK) 
                WHERE TIPO = 'MAKE' AND LEFT(COMMESSA, 7) = @rootCommessaKey AND PART_NUMBER IS NOT NULL
            `, { rootCommessaKey }, 'NETPRO');
            if (ordRes.recordset.length > 0 && ordRes.recordset[0].PART_NUMBER) {
                partNumber = ordRes.recordset[0].PART_NUMBER;
            }
        }

        const cleanPartNumber = (partNumber || '').trim();

        // 1. Fetch Distinta Base operations from cicli (BUSINESS)
        let diba_operations: DibaOperationRow[] = [];
        if (cleanPartNumber) {
            const dibaRes = await queryMSSQL(`
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
                WHERE dd.codditt = 'COOPZANARDI'
                  AND dd.dd_coddb = @cleanPartNumber
                ORDER BY dd.dd_riga ASC
            `, { cleanPartNumber }, 'BUSINESS');
            diba_operations = dibaRes.recordset;
        }

        // 2. Fetch Ordine di Produzione operations from OPERAZIONI (NETPRO)
        const orderRes = await queryMSSQL(`
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

        const order_operations: OrderProductionOperationRow[] = orderRes.recordset;
        const ordine_netpro = order_operations.length > 0 ? order_operations[0].ordine : '';

        // 2b. Fetch Business production order phases (attivit + assris)
        let business_operations: BusinessOrderOperationRow[] = [];
        if (orderBusInfo) {
            const busOpsRes = await queryMSSQL(`
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
                WHERE at.codditt = 'COOPZANARDI'
                  AND at.at_tipork = 'H'
                  AND at.at_anno = @anno
                  AND at.at_numord = @numord
                  AND at.at_riga = @riga
                ORDER BY at.at_fase ASC
            `, { anno: orderBusInfo.anno, numord: orderBusInfo.numord, riga: orderBusInfo.riga }, 'BUSINESS');
            business_operations = busOpsRes.recordset;
        }

        // 2c. Fetch NetPro order materials (MATERIALI_ORDINI)
        let netpro_materials: OrderMaterialSummaryRow[] = [];
        if (ordine_netpro) {
            const netMatRes = await queryMSSQL(`
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
            `, { ordine_netpro }, 'NETPRO');
            netpro_materials = netMatRes.recordset;
        }

        // 3. Fetch DiBa materials from movdis (BUSINESS)
        let diba_materials: DibaMaterialRow[] = [];
        if (cleanPartNumber) {
            const dibaMatRes = await queryMSSQL(`
                SELECT 
                    md.md_riga as riga,
                    RTRIM(md.md_codfigli) as codfigli,
                    ISNULL(RTRIM(ar.ar_descr), RTRIM(md.md_codfigli)) as description,
                    md.md_quant as quant,
                    ISNULL(md.md_perpz, 1000) as perpz,
                    RTRIM(md.md_unmis) as unmis
                FROM movdis md WITH (NOLOCK)
                LEFT JOIN artico ar WITH (NOLOCK) ON ar.codditt = md.codditt AND ar.ar_codart = md.md_codfigli
                WHERE md.codditt = 'COOPZANARDI' AND md.md_coddb = @cleanPartNumber
                ORDER BY md.md_riga ASC
            `, { cleanPartNumber }, 'BUSINESS');
            diba_materials = dibaMatRes.recordset;
        }

        // 4. Fetch Order materials from movord Tipo 'Y' (BUSINESS)
        let order_materials: OrderMaterialSummaryRow[] = [];
        if (orderBusInfo) {
            const busMatRes = await queryMSSQL(`
                SELECT 
                    mo_riga as riga,
                    RTRIM(mo_codart) as part_number,
                    RTRIM(mo_descr) as description,
                    mo_quant as quant,
                    RTRIM(mo_unmis) as unmis
                FROM movord WITH (NOLOCK)
                WHERE codditt = 'COOPZANARDI' 
                  AND mo_tipork = 'Y'
                  AND mo_anno = @anno
                  AND mo_numord = @numord
                  AND mo_rigaor = @riga
                ORDER BY mo_riga ASC
            `, { anno: orderBusInfo.anno, numord: orderBusInfo.numord, riga: orderBusInfo.riga }, 'BUSINESS');
            order_materials = busMatRes.recordset;
        }

        // 5. Discrepancies: DiBa (truth) vs Business order vs NetPro order (shared logic with the UI)
        const fatherQuant = orderBusInfo?.quant || 1000;
        const discrepancy_count = countDiscrepancies(
            compareOperations(diba_operations, business_operations, order_operations),
            compareMaterials(diba_materials, order_materials, netpro_materials, fatherQuant),
        );

        return {
            article_father: cleanPartNumber,
            ordine_netpro,
            commessa_full: orderBusInfo ? String(orderBusInfo.commeca) : undefined,
            order_bus_numord: orderBusInfo?.numord,
            order_bus_anno: orderBusInfo?.anno,
            order_bus_riga: orderBusInfo?.riga,
            order_father_quant: orderBusInfo?.quant,
            diba_operations,
            order_operations,
            business_operations,
            diba_materials,
            order_materials,
            netpro_materials,
            has_discrepancies: discrepancy_count > 0,
            discrepancy_count
        };
    } catch (err) {
        console.error('Error in fetchOrderOperationsManagement:', err);
        return {
            article_father: partNumberHint || '',
            ordine_netpro: '',
            diba_operations: [],
            order_operations: [],
            diba_materials: [],
            order_materials: [],
            has_discrepancies: false,
            discrepancy_count: 0
        };
    }
}

/**
 * Fast refresh action for operations management data
 */
export async function refreshOrderOperationsManagementAction(rootCommessaKey: string, partNumberHint?: string, commessaFull?: string) {
    try {
        const operationsManagement = await fetchOrderOperationsManagement(rootCommessaKey, partNumberHint, commessaFull);
        return { success: true, operationsManagement };
    } catch (err: any) {
        return {
            success: false,
            error: err.message,
            operationsManagement: {
                article_father: '',
                ordine_netpro: '',
                diba_operations: [],
                order_operations: [],
                diba_materials: [],
                order_materials: [],
                has_discrepancies: false,
                discrepancy_count: 0
            }
        };
    }
}

/**
 * Synchronize Business and NetPro orders in-place from Distinta Base (Single Source of Truth)
 * Updates:
 * - Business: attivit, assris, movord (Tipo Y), keyord
 * - NetPro: OPERAZIONI, TASKS, JOBSET, MATERIALI_ORDINI
 * NOTE: artpro is intentionally left untouched (handled automatically upon order completion)
 */
export async function syncOrderFromDibaAction(params: {
    rootCommessaKey: string;
    articleFather?: string;
}) {
    try {
        const { rootCommessaKey, articleFather: articleFatherHint } = params;

        // 1. Get Production Order Father Row (movord Tipo H)
        const busOrderRes = await queryMSSQL(`
            SELECT TOP 1 
                mo_anno, mo_serie, mo_numord, mo_riga, mo_codart, mo_quant, mo_commeca, mo_datcons
            FROM movord WITH (NOLOCK)
            WHERE codditt = 'COOPZANARDI'
              AND mo_tipork = 'H'
              AND LEFT(CAST(mo_commeca AS VARCHAR(20)), 7) = @rootCommessaKey
            ORDER BY mo_anno DESC, mo_numord DESC
        `, { rootCommessaKey }, 'BUSINESS');

        if (busOrderRes.recordset.length === 0) {
            return { success: false, error: 'Nessun ordine di produzione (Tipo H) trovato per questa commessa.' };
        }

        // SAFETY GUARD: this sync is not edition-aware yet. With more than one edition (H rows) or more than
        // one NetPro MAKE order on the commessa it could pick the wrong order and its attivit/assris
        // statements are not filtered by edition, so refuse instead of risking writes on other editions.
        const editionCheck = await queryMSSQL(`
            SELECT COUNT(*) AS n FROM movord WITH (NOLOCK)
            WHERE codditt = 'COOPZANARDI' AND mo_tipork = 'H'
              AND LEFT(CAST(mo_commeca AS VARCHAR(20)), 7) = @rootCommessaKey
        `, { rootCommessaKey }, 'BUSINESS');
        const netOrderCheck = await queryMSSQL(`
            SELECT COUNT(*) AS n FROM ORDINI WITH (NOLOCK)
            WHERE TIPO = 'MAKE' AND LEFT(COMMESSA, 7) = @rootCommessaKey
        `, { rootCommessaKey }, 'NETPRO');
        if (editionCheck.recordset[0].n > 1 || netOrderCheck.recordset[0].n > 1) {
            return {
                success: false,
                error: `Riallineamento non disponibile: la commessa ha più edizioni/ordini (Business H: ${editionCheck.recordset[0].n}, NetPro: ${netOrderCheck.recordset[0].n}). Supportati per ora solo ordini a edizione singola.`
            };
        }

        const busOrder = busOrderRes.recordset[0];
        const articleFather = (articleFatherHint || busOrder.mo_codart).trim();
        const orderFatherQuant = Number(busOrder.mo_quant) || 1000;
        const anno = busOrder.mo_anno;
        const numord = busOrder.mo_numord;
        const rigaPadre = busOrder.mo_riga;

        // 2. Get NetPro Order (ORDINI TIPO 'MAKE')
        const netOrderRes = await queryMSSQL(`
            SELECT TOP 1 ORDINE, PART_NUMBER 
            FROM ORDINI WITH (NOLOCK)
            WHERE TIPO = 'MAKE' AND LEFT(COMMESSA, 7) = @rootCommessaKey
            ORDER BY ORDINE DESC
        `, { rootCommessaKey }, 'NETPRO');

        const netOrdine = netOrderRes.recordset.length > 0 ? netOrderRes.recordset[0].ORDINE : `H${String(anno).substring(2)} ${String(numord).padStart(9, '0')}${String(rigaPadre).padStart(4, '0')}`;

        // 3. Fetch DiBa Operations (truth from cicli)
        const dibaOpsRes = await queryMSSQL(`
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
            WHERE dd.codditt = 'COOPZANARDI'
              AND dd.dd_coddb = @articleFather
            ORDER BY dd.dd_fase ASC
        `, { articleFather }, 'BUSINESS');
        const dibaOps: DibaOperationRow[] = dibaOpsRes.recordset;

        // 4. Fetch Current NetPro Operations
        const netOpsRes = await queryMSSQL(`
            SELECT ID_OPER, SEQUENZA, DESCRIZIONE 
            FROM OPERAZIONI WITH (NOLOCK) 
            WHERE ORDINE = @netOrdine
            ORDER BY SEQUENZA ASC
        `, { netOrdine }, 'NETPRO');
        const netOps = netOpsRes.recordset;

        const dibaFasi = new Set(dibaOps.map(o => o.fase));
        const netFasi = new Set(netOps.map(o => o.SEQUENZA));

        // Operations to remove (in order but not in DiBa)
        const opsToRemoveNet = netOps.filter(o => !dibaFasi.has(o.SEQUENZA));
        for (const op of opsToRemoveNet) {
            await queryMSSQL(`DELETE FROM JOBSET WHERE ID_OPER = @id_oper`, { id_oper: op.ID_OPER }, 'NETPRO');
            await queryMSSQL(`DELETE FROM TASKS WHERE TASK = @id_oper`, { id_oper: op.ID_OPER }, 'NETPRO');
            await queryMSSQL(`DELETE FROM OPERAZIONI WHERE ID_OPER = @id_oper`, { id_oper: op.ID_OPER }, 'NETPRO');
            await queryMSSQL(`
                DELETE FROM assris WHERE codditt = 'COOPZANARDI' AND as_numord = @numord AND as_anno = @anno AND as_fase = @fase
            `, { numord, anno, fase: op.SEQUENZA }, 'BUSINESS');
            await queryMSSQL(`
                DELETE FROM attivit WHERE codditt = 'COOPZANARDI' AND at_numord = @numord AND at_anno = @anno AND at_fase = @fase
            `, { numord, anno, fase: op.SEQUENZA }, 'BUSINESS');
        }

        // Operations to add (in DiBa but not in order)
        const opsToAdd = dibaOps.filter(o => !netFasi.has(o.fase));
        for (const op of opsToAdd) {
            const ov = buildNetProOverrides(op, netOrdine, orderFatherQuant, NOW);
            const bv = buildBusinessOverrides(op, orderFatherQuant);
            const exists = async (t: string, w: string, p: any, db: any) =>
                (await queryMSSQL(`SELECT TOP 1 1 AS x FROM ${t} WITH (NOLOCK) WHERE ${w}`, p, db)).recordset.length > 0;

            // NetPro: OPERAZIONI + TASKS + JOBSET (cloned from existing rows of this order)
            if (!(await exists('OPERAZIONI', 'ID_OPER = @id', { id: ov.idOper }, 'NETPRO'))) {
                await cloneRowInsert('NETPRO', 'OPERAZIONI', 'ORDINE = @netOrdine', { netOrdine }, ov.OPERAZIONI);
            }
            if (!(await exists('TASKS', 'TASK = @id', { id: ov.idOper }, 'NETPRO'))) {
                await cloneRowInsert('NETPRO', 'TASKS', 'TASK IN (SELECT TASK FROM JOBSET WHERE ORDINE = @netOrdine)', { netOrdine }, ov.TASKS);
            }
            if (!(await exists('JOBSET', 'ID_OPER = @id AND TASK = @id', { id: ov.idOper }, 'NETPRO'))) {
                await cloneRowInsert('NETPRO', 'JOBSET', 'ORDINE = @netOrdine', { netOrdine }, ov.JOBSET);
            }

            // Business: attivit + assris (cloned from existing rows of this order)
            if (!(await exists('attivit', "codditt = 'COOPZANARDI' AND at_numord = @numord AND at_anno = @anno AND at_fase = @fase", { numord, anno, fase: op.fase }, 'BUSINESS'))) {
                await cloneRowInsert('BUSINESS', 'attivit', "codditt = 'COOPZANARDI' AND at_numord = @numord AND at_anno = @anno", { numord, anno }, bv.attivit);
            }
            if (!(await exists('assris', "codditt = 'COOPZANARDI' AND as_numord = @numord AND as_anno = @anno AND as_fase = @fase", { numord, anno, fase: op.fase }, 'BUSINESS'))) {
                await cloneRowInsert('BUSINESS', 'assris', "codditt = 'COOPZANARDI' AND as_numord = @numord AND as_anno = @anno", { numord, anno }, bv.assris);
            }
        }

        // Operations to update (exist in both DiBa and order — refresh all mutable fields from DiBa)
        const opsToUpdate = dibaOps.filter(o => netFasi.has(o.fase));
        for (const op of opsToUpdate) {
            const idOper = `${netOrdine}${String(op.fase).padStart(2, '0')}`;

            // Business attivit — work type, planned time (sec), planned qty, terzista, notes
            await queryMSSQL(`
                UPDATE attivit
                SET at_codlavo    = @codlavo,
                    at_tempesepr  = @tesec,
                    at_qtapr      = @orderFatherQuant,
                    at_terzista   = @terzista,
                    at_note       = @note
                WHERE codditt = 'COOPZANARDI'
                  AND at_numord = @numord
                  AND at_anno   = @anno
                  AND at_fase   = @fase
            `, { codlavo: op.codlavo, tesec: op.tesec, orderFatherQuant, terzista: op.terzista, note: op.note || null, numord, anno, fase: op.fase }, 'BUSINESS');

            // Business assris — work center
            await queryMSSQL(`
                UPDATE assris
                SET as_codcent = @codcent
                WHERE codditt = 'COOPZANARDI'
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

        // Fase chain: NetPro CENTRO_SUCCESSIVO / Business at_sufase = next phase in sequence
        const chainRes = await queryMSSQL(`
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
                WHERE codditt = 'COOPZANARDI' AND at_numord = @numord AND at_anno = @anno AND at_fase = @fase
            `, {
                next: next ? next.SEQUENZA : 0,
                suanno: next ? anno : 0, sunumord: next ? numord : 0, suriga: next ? rigaPadre : 0,
                numord, anno, fase: chainOps[i].SEQUENZA,
            }, 'BUSINESS');
        }

        // 5. Sync Materials
        // Fetch DiBa Materials
        const dibaMatRes = await queryMSSQL(`
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
            WHERE md.codditt = 'COOPZANARDI' AND md.md_coddb = @articleFather
            ORDER BY md.md_riga ASC
        `, { articleFather }, 'BUSINESS');
        // MP_FITTIZIA placeholder is never synced (not added, updated or removed)
        const dibaMat: DibaMaterialRow[] = dibaMatRes.recordset.filter((m: DibaMaterialRow) => !isPlaceholderMaterial(m.codfigli));

        // Fetch Current Business Materials (movord Tipo Y)
        const busMatRes = await queryMSSQL(`
            SELECT 
                mo_riga, RTRIM(mo_codart) as codart, mo_quant, RTRIM(mo_descr) as descr, RTRIM(mo_unmis) as unmis,
                mo_disbasriga as disbasriga
            FROM movord WITH (NOLOCK)
            WHERE codditt = 'COOPZANARDI' AND mo_numord = @numord AND mo_anno = @anno AND mo_tipork = 'Y'
              AND mo_rigaor = @rigaPadre
            ORDER BY mo_riga ASC
        `, { numord, anno, rigaPadre }, 'BUSINESS');
        const busMat = busMatRes.recordset.filter((m: any) => !isPlaceholderMaterial(m.codart));

        // Link like the official process: Business Y row ↔ DiBa row via mo_disbasriga = md_riga,
        // NetPro row ↔ Business row via MATERIALI_ORDINI.SEQUENZA = mo_riga (a DiBa can list the same code twice)
        const dibaByRiga = new Map<number, DibaMaterialRow>(dibaMat.map(m => [Number(m.riga), m]));
        const busByDibaRiga = new Map<number, any>();
        // Row numbers are taken over ALL order rows (incl. MP_FITTIZIA) so a new row never reuses one
        let maxRiga = 0;
        for (const m of busMatRes.recordset) if (m.mo_riga > maxRiga) maxRiga = m.mo_riga;
        for (const m of busMat) {
            if (m.mo_riga > maxRiga) maxRiga = m.mo_riga;
            busByDibaRiga.set(Number(m.disbasriga), m);
        }

        // Remove order rows whose DiBa row is gone or now holds a different code
        for (const m of busMat) {
            const dm = dibaByRiga.get(Number(m.disbasriga));
            if (dm && dm.codfigli === m.codart && busByDibaRiga.get(Number(m.disbasriga)) === m) continue;

            await queryMSSQL(`
                DELETE FROM keyord
                WHERE codditt = 'COOPZANARDI' AND ko_numord = @numord AND ko_anno = @anno AND ko_tipork = 'Y' AND ko_riga = @riga
            `, { numord, anno, riga: m.mo_riga }, 'BUSINESS');

            await queryMSSQL(`
                DELETE FROM movord
                WHERE codditt = 'COOPZANARDI' AND mo_numord = @numord AND mo_anno = @anno AND mo_tipork = 'Y' AND mo_riga = @riga
            `, { numord, anno, riga: m.mo_riga }, 'BUSINESS');

            await queryMSSQL(`
                DELETE FROM MATERIALI_ORDINI
                WHERE ORDINE = @netOrdine AND SEQUENZA = @riga
            `, { netOrdine, riga: m.mo_riga }, 'NETPRO');

            if (busByDibaRiga.get(Number(m.disbasriga)) === m) busByDibaRiga.delete(Number(m.disbasriga));
        }

        // Add or update materials from DiBa
        for (const dm of dibaMat) {
            const expectedQuant = dibaMaterialQty(orderFatherQuant, dm.quant, dm.perpz);
            // NetPro QTA_IMPIEGO = quantity per produced piece (e.g. 1200 / 1358)
            const qtaImpiego = orderFatherQuant ? expectedQuant / orderFatherQuant : 0;
            const existing = busByDibaRiga.get(Number(dm.riga));

            if (existing && existing.codart === dm.codfigli) {
                const riga = existing.mo_riga;
                // Update Business movord
                await queryMSSQL(`
                    UPDATE movord
                    SET mo_quant = @expectedQuant, mo_colli = @expectedQuant, mo_ultagg = GETDATE()
                    WHERE codditt = 'COOPZANARDI' AND mo_numord = @numord AND mo_anno = @anno AND mo_tipork = 'Y' AND mo_riga = @riga
                `, { expectedQuant, numord, anno, riga }, 'BUSINESS');

                // Update NetPro MATERIALI_ORDINI
                await queryMSSQL(`
                    UPDATE MATERIALI_ORDINI
                    SET QUANTITA = @expectedQuant, QTA_IMPIEGO = @qtaImpiego
                    WHERE ORDINE = @netOrdine AND SEQUENZA = @riga
                `, { expectedQuant, qtaImpiego, netOrdine, riga }, 'NETPRO');
            } else {
                maxRiga += 5;
                const newRiga = maxRiga;

                const tplParams = { anno, numord };
                const busTpl = "codditt = 'COOPZANARDI' AND mo_anno = @anno AND mo_numord = @numord AND mo_tipork = 'Y'";
                // Business movord (cloned from an existing material row of this order; price fields not recalculated)
                await cloneRowInsert('BUSINESS', 'movord', busTpl, tplParams, {
                    mo_riga: newRiga, mo_codart: dm.codfigli, mo_unmis: dm.unmis || 'Nr', mo_ump: dm.unmis || 'Nr',
                    mo_descr: dm.description, mo_colli: expectedQuant, mo_quant: expectedQuant, mo_coleva: 0, mo_quaeva: 0,
                    mo_prezzo: 0, mo_valore: 0, mo_valoremm: 0, mo_desint: (dm as any).desint || null, mo_stasino: 'N',
                    mo_disbasriga: dm.riga, mo_ultagg: NOW,
                });
                // Business keyord (ko_conto etc. copied from the order's existing rows)
                await cloneRowInsert('BUSINESS', 'keyord',
                    "codditt = 'COOPZANARDI' AND ko_anno = @anno AND ko_numord = @numord AND ko_tipork = 'Y'", tplParams,
                    { ko_riga: newRiga, ko_codart: dm.codfigli });
                // NetPro MATERIALI_ORDINI (cloned from an existing row of this order)
                await cloneRowInsert('NETPRO', 'MATERIALI_ORDINI', 'ORDINE = @netOrdine', { netOrdine }, {
                    SEQUENZA: newRiga, PART_NUMBER: dm.codfigli, QUANTITA: expectedQuant, QTA_IMPIEGO: qtaImpiego,
                });
            }
        }

        // NOTE: artpro is intentionally NOT modified (handled automatically by NetPro on order completion)

        return {
            success: true,
            message: 'Ordine sincronizzato e riallineato con successo alla DiBa!'
        };
    } catch (err: any) {
        console.error('Error in syncOrderFromDibaAction:', err);
        return {
            success: false,
            error: err.message
        };
    }
}


export async function getOrderOperationsAction(
    searchTerm?: string
) {
    const emptyOpsManagement: OrderOperationsManagementData = {
        article_father: '',
        ordine_netpro: '',
        diba_operations: [],
        order_operations: []
    };

    try {
        if (!searchTerm || searchTerm.trim() === '') {
            return {
                success: true,
                status: 'empty' as const,
                matches: [] as MasterOrderMatch[],
                data: [],
                editions: [],
                materials: [] as Material[],
                operationsManagement: emptyOpsManagement,
                message: 'Enter a commessa number or order description to search'
            };
        }

        const cleanTerm = searchTerm.trim();
        const term = `%${cleanTerm}%`;
        const prefixTerm = `${cleanTerm}%`;
        const busDb = process.env.MSSQL_DATABASE_BUSINESS || 'COOPZANARDI';

        // Find all matching master orders
        const matchesResult = await queryMSSQL(`
            SELECT 
                LEFT(ORD.COMMESSA, 7) as root_commessa_key,
                SUBSTRING(ORD.COMMESSA, 4, 4) as commessa_display,
                LEFT(ORD.COMMESSA, 2) as year_code,
                ISNULL(MAX(COM.co_descr1), MAX(ORD.DESCRIZIONE)) as master_order_title,
                ISNULL(MAX(CCA.descr), '') as client_name,
                COUNT(DISTINCT ORD.COMMESSA) as edition_count
            FROM ORDINI AS ORD WITH (NOLOCK)
            LEFT JOIN ${busDb}.dbo.COMMESS AS COM WITH (NOLOCK) ON TRY_CAST(ORD.COMMESSA AS BIGINT) = COM.co_comme
            LEFT JOIN cliente_commessa_attivita AS CCA WITH (NOLOCK) ON ORD.COMMESSA = CCA.commessa
            WHERE ORD.TIPO = 'MAKE'
              AND (
                SUBSTRING(ORD.COMMESSA, 4, 4) LIKE @term
                OR ORD.COMMESSA LIKE @prefixTerm
                OR ORD.DESCRIZIONE LIKE @term
                OR COM.co_descr1 LIKE @term
              )
            GROUP BY LEFT(ORD.COMMESSA, 7), SUBSTRING(ORD.COMMESSA, 4, 4), LEFT(ORD.COMMESSA, 2)
            ORDER BY LEFT(ORD.COMMESSA, 7) DESC
        `, { term, prefixTerm }, 'NETPRO');

        const matches: MasterOrderMatch[] = matchesResult.recordset;

        if (matches.length === 0) {
            return {
                success: true,
                status: 'empty' as const,
                matches: [],
                data: [],
                editions: [],
                materials: [] as Material[],
                operationsManagement: emptyOpsManagement,
                message: 'No orders found matching your search'
            };
        }

        // If only 1 master order matches, load its details directly
        if (matches.length === 1) {
            const { editions, data, materials, operationsManagement } = await fetchOrderDetailsByKey(matches[0].root_commessa_key);
            return {
                success: true,
                status: 'single' as const,
                matches: [],
                data,
                editions,
                materials,
                operationsManagement,
                message: null
            };
        }

        // If multiple master orders match, return the matches list for user selection
        return {
            success: true,
            status: 'multiple' as const,
            matches,
            data: [],
            editions: [],
            materials: [] as Material[],
            operationsManagement: emptyOpsManagement,
            message: null
        };
    } catch (err: any) {
        return {
            success: false,
            status: 'error' as const,
            error: err.message,
            matches: [] as MasterOrderMatch[],
            data: [],
            editions: [],
            materials: [] as Material[],
            operationsManagement: emptyOpsManagement,
            message: null
        };
    }
}

export async function getSingleOrderDetailsAction(rootCommessaKey: string) {
    try {
        const { editions, data, materials, operationsManagement } = await fetchOrderDetailsByKey(rootCommessaKey);
        return {
            success: true,
            data,
            editions,
            materials,
            operationsManagement
        };
    } catch (err: any) {
        return {
            success: false,
            error: err.message,
            data: [],
            editions: [],
            materials: [] as Material[],
            operationsManagement: {
                article_father: '',
                ordine_netpro: '',
                diba_operations: [],
                order_operations: []
            }
        };
    }
}

