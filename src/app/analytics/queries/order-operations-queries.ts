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
export async function getOrderOperationsAction(
    searchTerm?: string
) {
    try {
        if (!searchTerm || searchTerm.trim() === '') {
            return {
                success: true,
                data: [],
                editions: [],
                message: 'Enter a commessa number or order description to search'
            };
        }

        const term = `%${searchTerm.trim()}%`;

        // Get all matching orders (editions)
        const editionsResult = await queryMSSQL(`
            SELECT DISTINCT
                SUBSTRING(ORD.COMMESSA, 4, 4) as commessa_display,
                ORD.COMMESSA as commessa_full,
                ORD.DESCRIZIONE as order_description
            FROM ORDINI AS ORD WITH (NOLOCK)
            WHERE ORD.TIPO = 'MAKE'
              AND (
                SUBSTRING(ORD.COMMESSA, 4, 4) LIKE @term
                OR ORD.DESCRIZIONE LIKE @term
              )
            ORDER BY ORD.COMMESSA
        `, { term }, 'NETPRO');

        if (editionsResult.recordset.length === 0) {
            return {
                success: true,
                data: [],
                editions: [],
                message: 'No orders found matching your search'
            };
        }

        // Get operations for all matching orders, grouped by machine + area
        // Area name fetched directly via CENTRI → AREE join (no post-fetch lookup needed)
        const result = await queryMSSQL(`
            SELECT 
                TSK.MACCHINA as machine_code,
                MAC.DESCRIZIONE as machine_name,
                OPER.DESCRIZIONE as operation_name,
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
            WHERE ORD.TIPO = 'MAKE'
              AND (
                SUBSTRING(ORD.COMMESSA, 4, 4) LIKE @term
                OR ORD.DESCRIZIONE LIKE @term
              )
            GROUP BY TSK.MACCHINA, MAC.DESCRIZIONE, OPER.DESCRIZIONE, ARE.DESCRIZIONE
        `, { term }, 'NETPRO');

        return {
            success: true,
            data: result.recordset,
            editions: editionsResult.recordset,
            message: null
        };
    } catch (err: any) {
        return {
            success: false,
            error: err.message,
            data: [],
            editions: [],
            message: null
        };
    }
}
