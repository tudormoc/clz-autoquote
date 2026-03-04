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


/**
 * ============================================================================
 * AREA SUMMARY REPORT (Custom Area Grouping by Machine Time)
 * ============================================================================
 * 
 * Shows total MACHINE work time grouped by custom-defined areas.
 * Uses TIPO_OGGETTO='MAC' (machine time, not operator time).
 * Areas are defined in APP_CONFIG.ANALYTICS.MACHINE_AREAS.
 * 
 * FILTERS:
 * - Date range (required)
 * - Area name (fuzzy search, optional)
 * 
 * GROUPING: By custom area (machines grouped per area config)
 * 
 * PERFORMANCE: Fast - aggregates machine data then groups by area in application layer
 * ============================================================================
 */
export async function getAreaSummaryDataAction(
    year: number = 2024,
    page: number = 1,
    limit: number = 100,
    filters?: {
        machine?: string; // Now used as area filter
        dateFrom?: string;
        dateTo?: string;
    },
    sort?: SortConfig,
    exportAll: boolean = false
) {
    try {
        const startDate = filters?.dateFrom || `${year}-01-01`;
        const endDate = filters?.dateTo || `${year + 2}-01-01`;

        // Build WHERE conditions - using MAC data (machine time, not operator time)
        const conditions: string[] = [
            'SIT.DATA >= @startDate',
            'SIT.DATA <= @endDate',
            'SIT.TIPO = @tipo',
            'SIT.TIPO_OGGETTO = @tipoOggetto',
            'SIT.LAVORO > 0'  // Ignore rows with zero work time
        ];

        const params: Record<string, any> = {
            startDate,
            endDate,
            tipo: 'WORK',
            tipoOggetto: 'MAC',
        };

        const whereClause = conditions.join(' AND ');

        // Get machine work times and track unique commessas
        // Filter: only include commessas with QTA_RICHIESTA >= 10
        const result = await queryMSSQL(`
            SELECT 
                SIT.MACCHINA as machine_code,
                JST.ORDINE as ordine,
                SUM(SIT.LAVORO) as work_time,
                MAX(ISNULL(JST.QTA_RICHIESTA, 0)) as requested_quantity
            FROM SITUAZIONI SIT WITH (NOLOCK)
            LEFT JOIN JOBSET JST WITH (NOLOCK) ON SIT.TASK = JST.TASK
            WHERE ${whereClause}
              AND (JST.QTA_RICHIESTA IS NULL OR JST.QTA_RICHIESTA >= 10)
            GROUP BY SIT.MACCHINA, JST.ORDINE
        `, params, 'NETPRO');

        // Import machine areas config
        const { APP_CONFIG } = await import('@/config/constants');
        const MACHINE_AREAS = APP_CONFIG.ANALYTICS.MACHINE_AREAS;

        // Group machines by custom areas and track unique commessas
        const areaMap = new Map<string, { work_time: number; commessas: Map<number, number> }>();
        
        result.recordset.forEach(row => {
            // Find which area this machine belongs to
            for (const [areaName, machineCodes] of Object.entries(MACHINE_AREAS)) {
                const codes = machineCodes as readonly string[];
                if (codes.includes(row.machine_code)) {
                    const current = areaMap.get(areaName) || { work_time: 0, commessas: new Map() };
                    
                    // Add work time
                    current.work_time += row.work_time;
                    
                    // Track unique commessa quantity (only count each commessa once)
                    if (row.ordine && !current.commessas.has(row.ordine)) {
                        current.commessas.set(row.ordine, row.requested_quantity);
                    }
                    
                    areaMap.set(areaName, current);
                    break;
                }
            }
        });

        // Convert to array format and sum unique commessa quantities
        let areaData = Array.from(areaMap.entries()).map(([area_name, data]) => {
            const totalQty = Array.from(data.commessas.values()).reduce((sum, qty) => sum + qty, 0);
            const velocity = data.work_time > 0 ? totalQty / data.work_time : 0;
            
            // Get target velocity and calculate efficiency
            const targetVelocity = APP_CONFIG.ANALYTICS.AREA_TARGET_VELOCITY[area_name as keyof typeof APP_CONFIG.ANALYTICS.AREA_TARGET_VELOCITY] || 0;
            const efficiency = targetVelocity > 0 ? (velocity / targetVelocity) * 100 : 0;
            
            return {
                area_name,
                work_time: data.work_time,
                requested_quantity: totalQty,
                velocity: velocity,
                target_velocity: targetVelocity,
                efficiency: efficiency,
                machine_count: (MACHINE_AREAS[area_name as keyof typeof MACHINE_AREAS] as readonly string[])?.length || 0
            };
        });

        // Apply area filter if provided
        if (filters?.machine) {
            const searchTerm = filters.machine.toLowerCase();
            areaData = areaData.filter(row => 
                row.area_name.toLowerCase().includes(searchTerm)
            );
        }

        // Sort data
        const sortColumn = sort?.column || 'work_time';
        const sortDirection = sort?.direction || 'desc';
        
        areaData.sort((a, b) => {
            let aVal: string | number;
            let bVal: string | number;
            
            if (sortColumn === 'area_name') {
                aVal = a.area_name;
                bVal = b.area_name;
            } else if (sortColumn === 'requested_quantity') {
                aVal = a.requested_quantity;
                bVal = b.requested_quantity;
            } else if (sortColumn === 'velocity') {
                aVal = a.velocity;
                bVal = b.velocity;
            } else if (sortColumn === 'efficiency') {
                aVal = a.efficiency;
                bVal = b.efficiency;
            } else {
                aVal = a.work_time;
                bVal = b.work_time;
            }
            
            if (typeof aVal === 'string') {
                return sortDirection === 'asc' 
                    ? aVal.localeCompare(bVal as string)
                    : (bVal as string).localeCompare(aVal);
            }
            
            return sortDirection === 'asc' ? aVal - (bVal as number) : (bVal as number) - aVal;
        });

        const total = areaData.length;
        
        // Apply pagination
        const offset = calculateOffset(page, limit);
        const paginatedData = exportAll ? areaData : areaData.slice(offset, offset + limit);

        return {
            success: true,
            data: paginatedData,
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
