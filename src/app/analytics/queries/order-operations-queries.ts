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

    const editionsResult = await queryMSSQL(`
        SELECT 
            SUBSTRING(ORD.COMMESSA, 4, 4) as commessa_display,
            ORD.COMMESSA as commessa_full,
            MAX(ORD.ORDINE) as ordine,
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

    const result = await queryMSSQL(`
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
        LEFT JOIN View_Note_Diba AS VND WITH (NOLOCK) ON OPER.ORDINE = VND.mo_netpid AND OPER.SEQUENZA = VND.at_fase
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

    const materialsResult = await queryMSSQL(`
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

    return {
        editions: editionsResult.recordset,
        data: result.recordset,
        materials: materialsResult.recordset as Material[]
    };
}

export async function getOrderOperationsAction(
    searchTerm?: string
) {
    try {
        if (!searchTerm || searchTerm.trim() === '') {
            return {
                success: true,
                status: 'empty' as const,
                matches: [] as MasterOrderMatch[],
                data: [],
                editions: [],
                materials: [] as Material[],
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
                message: 'No orders found matching your search'
            };
        }

        // If only 1 master order matches, load its details directly
        if (matches.length === 1) {
            const { editions, data, materials } = await fetchOrderDetailsByKey(matches[0].root_commessa_key);
            return {
                success: true,
                status: 'single' as const,
                matches: [],
                data,
                editions,
                materials,
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
            message: null
        };
    }
}

export async function getSingleOrderDetailsAction(rootCommessaKey: string) {
    try {
        const { editions, data, materials } = await fetchOrderDetailsByKey(rootCommessaKey);
        return {
            success: true,
            data,
            editions,
            materials
        };
    } catch (err: any) {
        return {
            success: false,
            error: err.message,
            data: [],
            editions: [],
            materials: [] as Material[]
        };
    }
}
