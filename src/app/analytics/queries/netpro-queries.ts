/**
 * NETPRO Database Queries
 * 
 * Queries that use only the NETPRO database (production tracking).
 * These are simpler than cross-database queries.
 * 
 * DATA SOURCE: NETPRO database
 * - SITUAZIONI: Time tracking records
 * - ORDINI: Order information
 * - JOBSET: Links tasks to orders
 * - MACCHINE: Machine details
 * - OPERATORI: Operator details
 */

'use server'

import { queryMSSQL } from '@/lib/mssql';
import {
    buildCommessaFilterNETPRO,
    buildMachineFilter,
    buildOperatorFilter
} from './shared/filter-builders';
import {
    calculateOffset,
    buildPaginationResult,
    buildProductionOrderBy,
    buildOrderSummaryOrderBy,
    type SortConfig
} from './shared/query-utils';

/**
 * ============================================================================
 * PRODUCTION REPORT
 * ============================================================================
 * 
 * Shows operator work time by date, machine, and commessa.
 * 
 * FILTERS:
 * - Date range (required)
 * - Commessa code or description (fuzzy search)
 * - Machine code or name (fuzzy search)
 * - Operator code or name (fuzzy search)
 * 
 * GROUPING: By date + machine + operator + commessa (4-digit display code)
 * 
 * PERFORMANCE: Fast - single database, indexed columns
 * ============================================================================
 */
export async function getProductionDataAction(
    year: number = 2024,
    page: number = 1,
    limit: number = 100,
    filters?: {
        commessa?: string;
        machine?: string;
        operator?: string;
        dateFrom?: string;
        dateTo?: string;
    },
    sort?: SortConfig,
    exportAll: boolean = false
) {
    try {
        const offset = calculateOffset(page, limit);
        const startDate = filters?.dateFrom || `${year}-01-01`;
        const endDate = filters?.dateTo || `${year + 2}-01-01`;

        // Build WHERE conditions
        const conditions: string[] = [
            'SIT.DATA >= @startDate',
            'SIT.DATA <= @endDate',
            'SIT.TIPO = @tipo',
            'SIT.TIPO_OGGETTO = @tipoOggetto',
            'ORD.COMMESSA IS NOT NULL'
        ];

        const params: Record<string, any> = {
            startDate,
            endDate,
            tipo: 'WORK',
            tipoOggetto: 'OPE',
            offset,
            limit
        };

        // Apply filters using shared utilities
        buildCommessaFilterNETPRO(filters?.commessa, conditions, params);
        buildMachineFilter(filters?.machine, conditions, params);
        buildOperatorFilter(filters?.operator, conditions, params);

        const whereClause = conditions.join(' AND ');

        // Build ORDER BY clause
        const orderByClause = buildProductionOrderBy(
            sort?.column || 'date',
            sort?.direction || 'asc'
        );

        // Get total count for pagination (includes all joins needed for filters)
        const countResult = await queryMSSQL(`
            SELECT COUNT(*) as total
            FROM (
                SELECT 1 as dummy
                FROM SITUAZIONI SIT WITH (NOLOCK)
                LEFT JOIN JOBSET JST WITH (NOLOCK) ON SIT.TASK = JST.TASK
                LEFT JOIN ORDINI ORD WITH (NOLOCK) ON JST.ORDINE = ORD.ORDINE
                LEFT JOIN MACCHINE MAC WITH (NOLOCK) ON SIT.MACCHINA = MAC.MACCHINA
                LEFT JOIN OPERATORI OPE WITH (NOLOCK) ON SIT.OGGETTO = OPE.OPERATORE
                WHERE ${whereClause}
                GROUP BY SIT.DATA, SIT.MACCHINA, SIT.OGGETTO, SUBSTRING(ORD.COMMESSA, 4, 4)
            ) AS grouped_data
        `, params, 'NETPRO');

        const total = countResult.recordset[0].total;

        // Get paginated data with grouping by core commessa number
        const result = await queryMSSQL(`
            SELECT 
                SIT.DATA as date,
                SIT.MACCHINA as machine,
                MAX(MAC.DESCRIZIONE) as machine_name,
                SIT.OGGETTO as operator,
                MAX(OPE.NOME) as operator_name,
                SUM(SIT.LAVORO) as work_time,
                SUM(SIT.QTA_COMPLETATA) as qty_completed,
                MAX(JST.QTA_RICHIESTA) as qty_requested,
                MIN(ORD.COMMESSA) as commessa_full,
                SUBSTRING(MIN(ORD.COMMESSA), 4, 4) as commessa_display,
                MIN(ORD.DESCRIZIONE) as order_description
            FROM SITUAZIONI SIT WITH (NOLOCK)
            LEFT JOIN JOBSET JST WITH (NOLOCK) ON SIT.TASK = JST.TASK
            LEFT JOIN ORDINI ORD WITH (NOLOCK) ON JST.ORDINE = ORD.ORDINE
            LEFT JOIN MACCHINE MAC WITH (NOLOCK) ON SIT.MACCHINA = MAC.MACCHINA
            LEFT JOIN OPERATORI OPE WITH (NOLOCK) ON SIT.OGGETTO = OPE.OPERATORE
            WHERE ${whereClause}
            GROUP BY SIT.DATA, SIT.MACCHINA, SIT.OGGETTO, SUBSTRING(ORD.COMMESSA, 4, 4)
            ORDER BY ${orderByClause}
            ${exportAll ? '' : 'OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY'}
        `, params, 'NETPRO');

        return {
            success: true,
            data: result.recordset,
            pagination: buildPaginationResult(page, limit, total)
        };
    } catch (err: any) {
        return {
            success: false,
            error: err.message,
            data: [],
            pagination: buildPaginationResult(page, limit, 0)
        };
    }
}

/**
 * ============================================================================
 * ORDER SUMMARY REPORT
 * ============================================================================
 * 
 * Get order summary data grouped by machine (sums operator time per machine).
 * Uses same data source as Production Report (TIPO_OGGETTO='OPE') but groups by machine.
 * 
 * FILTERS:
 * - Date range (required)
 * - Commessa code or description (fuzzy search)
 * - Machine code or name (fuzzy search)
 * 
 * GROUPING: By machine + commessa (4-digit display code)
 * 
 * PERFORMANCE: Fast - single database, indexed columns
 * ============================================================================
 */
export async function getOrderSummaryDataAction(
    year: number = 2024,
    page: number = 1,
    limit: number = 100,
    filters?: {
        commessa?: string;
        machine?: string;
        dateFrom?: string;
        dateTo?: string;
    },
    sort?: SortConfig,
    exportAll: boolean = false
) {
    try {
        const offset = calculateOffset(page, limit);
        const startDate = filters?.dateFrom || `${year}-01-01`;
        const endDate = filters?.dateTo || `${year + 2}-01-01`;

        // Build WHERE conditions - using OPE data (same as Production Report)
        const conditions: string[] = [
            'SIT.DATA >= @startDate',
            'SIT.DATA <= @endDate',
            'SIT.TIPO = @tipo',
            'SIT.TIPO_OGGETTO = @tipoOggetto',
            'ORD.COMMESSA IS NOT NULL'
        ];

        const params: Record<string, any> = {
            startDate,
            endDate,
            tipo: 'WORK',
            tipoOggetto: 'OPE',
            offset,
            limit
        };

        // Apply filters using shared utilities
        buildCommessaFilterNETPRO(filters?.commessa, conditions, params);
        buildMachineFilter(filters?.machine, conditions, params);

        const whereClause = conditions.join(' AND ');

        // Build ORDER BY clause
        const orderByClause = buildOrderSummaryOrderBy(
            sort?.column || 'commessa',
            sort?.direction || 'asc'
        );

        // Get total count for pagination
        const countResult = await queryMSSQL(`
            SELECT COUNT(*) as total
            FROM (
                SELECT 1 as dummy
                FROM SITUAZIONI SIT WITH (NOLOCK)
                LEFT JOIN JOBSET JST WITH (NOLOCK) ON SIT.TASK = JST.TASK
                LEFT JOIN ORDINI ORD WITH (NOLOCK) ON JST.ORDINE = ORD.ORDINE
                LEFT JOIN MACCHINE MAC WITH (NOLOCK) ON SIT.MACCHINA = MAC.MACCHINA
                WHERE ${whereClause}
                GROUP BY SIT.MACCHINA, SUBSTRING(ORD.COMMESSA, 4, 4)
            ) AS grouped_data
        `, params, 'NETPRO');

        const total = countResult.recordset[0].total;

        // Get paginated data grouped by machine + commessa (summing all operators and dates)
        const result = await queryMSSQL(`
            SELECT 
                SIT.MACCHINA as machine,
                MAX(MAC.DESCRIZIONE) as machine_name,
                SUM(SIT.LAVORO) as work_time,
                SUM(SIT.QTA_COMPLETATA) as qty_completed,
                MAX(JST.QTA_RICHIESTA) as qty_requested,
                MIN(ORD.COMMESSA) as commessa_full,
                SUBSTRING(MIN(ORD.COMMESSA), 4, 4) as commessa_display,
                MIN(ORD.DESCRIZIONE) as order_description
            FROM SITUAZIONI SIT WITH (NOLOCK)
            LEFT JOIN JOBSET JST WITH (NOLOCK) ON SIT.TASK = JST.TASK
            LEFT JOIN ORDINI ORD WITH (NOLOCK) ON JST.ORDINE = ORD.ORDINE
            LEFT JOIN MACCHINE MAC WITH (NOLOCK) ON SIT.MACCHINA = MAC.MACCHINA
            WHERE ${whereClause}
            GROUP BY SIT.MACCHINA, SUBSTRING(ORD.COMMESSA, 4, 4)
            ORDER BY ${orderByClause}
            ${exportAll ? '' : 'OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY'}
        `, params, 'NETPRO');

        return {
            success: true,
            data: result.recordset,
            pagination: buildPaginationResult(page, limit, total)
        };
    } catch (err: any) {
        return {
            success: false,
            error: err.message,
            data: [],
            pagination: buildPaginationResult(page, limit, 0)
        };
    }
}
