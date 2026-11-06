/**
 * Order search and the data of one master order for the work progress page (server only, read queries, NETPRO).
 *
 * Operation status over the editions: EXE if any edition is running, else SUS if any is suspended,
 * else COM if all are completed, else PENDING.
 */
import { queryMSSQL } from '@/lib/mssql';
import type { FlowOperation } from '@/lib/orders/flow';
import { fetchOrderManagement } from '@/lib/orders/management';
import { businessDb } from '@/lib/orders/sql';
import type { Material, MasterOrderMatch, OrderDetailsData } from '@/lib/orders/types';
import type { OrderEdition } from '@/types';

/** Master orders whose commessa number (4 digits or full) or description matches the text */
export async function findMasterOrders(text: string): Promise<MasterOrderMatch[]> {
    const cleanTerm = text.trim();
    const term = `%${cleanTerm}%`;
    const prefixTerm = `${cleanTerm}%`;
    const busDb = businessDb();

    const matchesResult = await queryMSSQL<MasterOrderMatch>(`
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

    return matchesResult.recordset;
}

/** Editions of the master order (one per commessa) with title and client */
function loadEditions(rootCommessaKey: string) {
    const busDb = businessDb();
    return queryMSSQL<OrderEdition>(`
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
}

/**
 * Operations of all editions grouped by machine and operation, with their DiBa note.
 * The notes are first copied into a table variable: joining View_Note_Diba directly made SQL Server pick a very
 * slow plan (0.5-2.5s); this returns identical rows in ~0.15s. Phases noted "NO" in the DiBa are left out.
 */
function loadFlowOperations(rootCommessaKey: string) {
    return queryMSSQL<FlowOperation>(`
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
}

/** Materials of the latest NetPro order of each edition, summed, with the stock (placeholder material left out) */
function loadMaterials(rootCommessaKey: string) {
    return queryMSSQL<Material>(`
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
}

/** Editions, production flow, materials and DiBa comparison of a master order (e.g. '2609493') */
export async function fetchOrderDetails(rootCommessaKey: string): Promise<OrderDetailsData> {
    const [editions, operations, materials] = await Promise.all([
        loadEditions(rootCommessaKey),
        loadFlowOperations(rootCommessaKey),
        loadMaterials(rootCommessaKey),
    ]);
    // The comparison starts from the first edition: its own order row, article and NetPro order (the editions of a
    // commessa can sit in different Business orders, so "the newest order of the commessa" could be another edition's)
    const first = editions.recordset[0];
    const management = await fetchOrderManagement(rootCommessaKey, first?.part_number, first?.commessa_full);

    return { editions: editions.recordset, operations: operations.recordset, materials: materials.recordset, management };
}
