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
import { fetchOrderBusinessData } from './shared/work-time-fetcher';
import {
    calculateOffset,
    buildPaginationResult,
    buildProductionOrderBy,
    buildOrderSummaryOrderBy,
    buildOrderAreaSummaryOrderBy,
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
                HAVING SUM(SIT.LAVORO) > 0.1
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
            HAVING SUM(SIT.LAVORO) > 0.1
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
                HAVING SUM(SIT.LAVORO) > 0.1
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
            HAVING SUM(SIT.LAVORO) > 0.1
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

        // Get machine work times WITHOUT joining to avoid duplicates
        // We'll get quantities separately since they're at order level
        const workTimeResult = await queryMSSQL(`
            SELECT 
                SIT.MACCHINA as machine_code,
                SUM(SIT.LAVORO) as work_time
            FROM SITUAZIONI SIT WITH (NOLOCK)
            WHERE ${whereClause}
            GROUP BY SIT.MACCHINA
        `, params, 'NETPRO');

        // Get quantities per machine-order for areas that need it
        const quantityResult = await queryMSSQL(`
            SELECT 
                SIT.MACCHINA as machine_code,
                JST.ORDINE as ordine,
                MAX(ISNULL(JST.QTA_RICHIESTA, 0)) as requested_quantity,
                SUM(ISNULL(SIT.QTA_COMPLETATA, 0)) as completed_quantity
            FROM SITUAZIONI SIT WITH (NOLOCK)
            INNER JOIN JOBSET JST WITH (NOLOCK) ON SIT.TASK = JST.TASK
            WHERE ${whereClause}
              AND (JST.QTA_RICHIESTA IS NULL OR JST.QTA_RICHIESTA >= 10)
            GROUP BY SIT.MACCHINA, JST.ORDINE
        `, params, 'NETPRO');

        // Import machine areas config
        const { APP_CONFIG } = await import('@/config/constants');
        const MACHINE_AREAS = APP_CONFIG.ANALYTICS.MACHINE_AREAS;

        // Create work time map by machine (no duplicates)
        const machineWorkTime = new Map<string, number>();
        workTimeResult.recordset.forEach(row => {
            machineWorkTime.set(row.machine_code, row.work_time);
        });

        // Group machines by custom areas
        const areaMap = new Map<string, { 
            work_time: number; 
            commessas: Map<number, number>;
        }>();
        
        // Add work time per area (from work time map, no duplicates)
        for (const [areaName, machineCodes] of Object.entries(MACHINE_AREAS)) {
            const codes = machineCodes as readonly string[];
            let totalWorkTime = 0;
            
            codes.forEach(machineCode => {
                totalWorkTime += machineWorkTime.get(machineCode) || 0;
            });
            
            areaMap.set(areaName, {
                work_time: totalWorkTime,
                commessas: new Map()
            });
        }
        
        // Now add quantities per order (from quantity result)
        quantityResult.recordset.forEach(row => {
            for (const [areaName, machineCodes] of Object.entries(MACHINE_AREAS)) {
                const codes = machineCodes as readonly string[];
                if (codes.includes(row.machine_code)) {
                    const current = areaMap.get(areaName);
                    if (current && row.ordine) {
                        if (areaName === 'Piega') {
                            // Sum all completed quantities for this order
                            const existingQty = current.commessas.get(row.ordine) || 0;
                            current.commessas.set(row.ordine, existingQty + row.completed_quantity);
                        } else {
                            // Use requested quantity (only store once per order)
                            if (!current.commessas.has(row.ordine)) {
                                current.commessas.set(row.ordine, row.requested_quantity);
                            }
                        }
                    }
                    break;
                }
            }
        });

        // Convert to array format and sum unique commessa quantities
        let areaData = Array.from(areaMap.entries()).map(([area_name, data], index) => {
            const totalQty = Array.from(data.commessas.values()).reduce((sum, qty) => sum + qty, 0);
            // Apply 2% excess for velocity calculation
            const adjustedQty = totalQty * 1.02;
            const velocity = data.work_time > 0 ? adjustedQty / data.work_time : 0;
            
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
                machine_count: (MACHINE_AREAS[area_name as keyof typeof MACHINE_AREAS] as readonly string[])?.length || 0,
                display_order: index // Track original order from MACHINE_AREAS
            };
        });

        // Apply area filter if provided
        if (filters?.machine) {
            const searchTerm = filters.machine.toLowerCase();
            areaData = areaData.filter(row => 
                row.area_name.toLowerCase().includes(searchTerm)
            );
        }

        // Sort data (if no sort specified, use display_order from MACHINE_AREAS)
        const sortColumn = sort?.column || 'display_order';
        const sortDirection = sort?.direction || 'asc';
        
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
            } else if (sortColumn === 'display_order') {
                aVal = a.display_order;
                bVal = b.display_order;
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

/**
 * ============================================================================
 * ORDER AREA SUMMARY REPORT
 * ============================================================================
 *
 * Shows operator work time per commessa grouped by custom area.
 * Uses the same OPE data as Order Summary but maps machines to areas
 * defined in APP_CONFIG.ANALYTICS.MACHINE_AREAS.
 *
 * COLUMNS: commessa, area, ore_lavoro_atteso (null - TBD), ore_lavoro, qnta_richiesta
 *
 * FILTERS:
 * - Date range (required)
 * - Commessa code or description (fuzzy search)
 * - Area name (fuzzy search, applied in app layer)
 *
 * GROUPING: By commessa + area (app-layer aggregation over machine groups)
 *
 * PERFORMANCE: Fast - single database, indexed columns
 * ============================================================================
 */
export async function getOrderAreaSummaryDataAction(
    year: number = 2024,
    page: number = 1,
    limit: number = 100,
    filters?: {
        commessa?: string;
        area?: string;
        dateFrom?: string;
        dateTo?: string;
        complexOnly?: boolean;
    },
    sort?: SortConfig,
    exportAll: boolean = false
) {
    try {
        const startDate = filters?.dateFrom || `${year}-01-01`;
        const endDate = filters?.dateTo || `${year + 2}-01-01`;

        // Build WHERE conditions - OPE data (operator work time)
        const conditions: string[] = [
            'SIT.DATA >= @startDate',
            'SIT.DATA <= @endDate',
            'SIT.TIPO = @tipo',
            'SIT.TIPO_OGGETTO = @tipoOggetto',
            'ORD.COMMESSA IS NOT NULL',
            'SUBSTRING(ORD.COMMESSA, 4, 4) NOT IN (\'9990\', \'9998\', \'9999\')'
        ];

        const params: Record<string, any> = {
            startDate,
            endDate,
            tipo: 'WORK',
            tipoOggetto: 'OPE',
        };

        // Apply commessa filter only (area filter is applied in app layer)
        buildCommessaFilterNETPRO(filters?.commessa, conditions, params);

        const whereClause = conditions.join(' AND ');

        // Build ORDER BY for the SQL query (pre-aggregation sort)
        const orderByClause = buildOrderAreaSummaryOrderBy(
            sort?.column || '',
            sort?.direction || 'asc'
        );

        // Fetch raw data grouped by machine + commessa (same as order summary)
        const rawResult = await queryMSSQL(`
            SELECT
                SIT.MACCHINA as machine_code,
                SUM(SIT.LAVORO) as work_time,
                MAX(JST.QTA_RICHIESTA) as qty_requested,
                MIN(ORD.COMMESSA) as commessa_full,
                SUBSTRING(MIN(ORD.COMMESSA), 4, 4) as commessa_display,
                MIN(ORD.DESCRIZIONE) as order_description,
                MAX(CCA.descr) as client_name
            FROM SITUAZIONI SIT WITH (NOLOCK)
            LEFT JOIN JOBSET JST WITH (NOLOCK) ON SIT.TASK = JST.TASK
            LEFT JOIN ORDINI ORD WITH (NOLOCK) ON JST.ORDINE = ORD.ORDINE
            LEFT JOIN cliente_commessa_attivita CCA WITH (NOLOCK) ON ORD.COMMESSA = CCA.commessa
            WHERE ${whereClause}
            GROUP BY SIT.MACCHINA, SUBSTRING(ORD.COMMESSA, 4, 4)
            HAVING SUM(SIT.LAVORO) > 0.1
            ORDER BY ${orderByClause}
        `, params, 'NETPRO');

        // Load machine→area config
        const { APP_CONFIG } = await import('@/config/constants');
        const MACHINE_AREAS = APP_CONFIG.ANALYTICS.MACHINE_AREAS;
        const areaOrderedList = Object.keys(MACHINE_AREAS);

        // Build a reverse map: machine_code → { area_name, area_index }
        const machineToArea = new Map<string, { name: string; index: number }>();
        areaOrderedList.forEach((areaName, index) => {
            const codes = MACHINE_AREAS[areaName as keyof typeof MACHINE_AREAS] as readonly string[];
            codes.forEach(code => {
                machineToArea.set(code, { name: areaName, index });
            });
        });

        // Aggregate per commessa + area in app layer
        // Key: `${commessa_display}__${area_name}`
        const aggMap = new Map<string, {
            commessa_full: string;
            commessa_display: string;
            order_description: string;
            area_name: string;
            area_index: number;
            work_time: number;
            qty_requested: number | null;
            client_name: string | null;
        }>();

        rawResult.recordset.forEach(row => {
            const area = machineToArea.get(row.machine_code) || null;
            if (!area) return; // Skip machines not mapped to any area

            const key = `${row.commessa_display}__${area.name}`;
            const existing = aggMap.get(key);
            if (existing) {
                existing.work_time += row.work_time || 0;
                // Use max of qty_requested across machines for same commessa+area
                if (row.qty_requested != null) {
                    existing.qty_requested = Math.max(existing.qty_requested ?? 0, row.qty_requested);
                }
                if (row.client_name) {
                    existing.client_name = row.client_name;
                }
            } else {
                aggMap.set(key, {
                    commessa_full: row.commessa_full,
                    commessa_display: row.commessa_display,
                    order_description: row.order_description,
                    area_name: area.name,
                    area_index: area.index,
                    work_time: row.work_time || 0,
                    qty_requested: row.qty_requested ?? null,
                    client_name: row.client_name || null,
                });
            }
        });

        // Aggregated per commessa + area in app layer
        // Filter by minimum work time and exclude zero velocity areas
        const minTimeHours = APP_CONFIG.ANALYTICS.MIN_WORK_TIME_MINUTES / 60;
        const filteredAggMapEntries = Array.from(aggMap.values()).filter(row => {
            const velocity = APP_CONFIG.ANALYTICS.AREA_EXPECTED_VELOCITY[row.area_name as keyof typeof APP_CONFIG.ANALYTICS.AREA_EXPECTED_VELOCITY] ?? 0;
            return velocity > 0 && row.work_time >= minTimeHours;
        });

        // Convert to array
        let resultData = filteredAggMapEntries;

        // Fetch business data from BUSINESS DB for all unique commessas
        const uniqueCommessas = Array.from(new Set(resultData.map(r => r.commessa_display)));
        let businessDataMap: Record<string, { pages: number, composition: string }> = {};
        if (uniqueCommessas.length > 0) {
            businessDataMap = await fetchOrderBusinessData(uniqueCommessas);
        }

        // Add pages and composition to resultData
        const enrichedResultData = resultData.map(r => {
            const bData = businessDataMap[r.commessa_display];
            const comp = bData?.composition || null;
            
            // Calculate fogli
            let fogli: number | null = null;
            if (comp) {
                const regex = /(\d+)\s*\//g;
                let sum = 0;
                let found = false;
                let match;
                while ((match = regex.exec(comp)) !== null) {
                    sum += parseInt(match[1], 10);
                    found = true;
                }
                if (found && r.qty_requested != null) {
                    fogli = sum * r.qty_requested;
                }
            }

            return {
                ...r,
                pages: bData?.pages ?? null,
                composition: comp,
                fogli: fogli
            };
        });
        
        resultData = enrichedResultData;

        // Filter by number of areas per commessa (Complex projects only)
        if (filters?.complexOnly) {
            const commessaAreaCounts = new Map<string, number>();
            resultData.forEach(r => {
                commessaAreaCounts.set(r.commessa_display, (commessaAreaCounts.get(r.commessa_display) || 0) + 1);
            });
            resultData = resultData.filter(r => (commessaAreaCounts.get(r.commessa_display) || 0) > 2);
        }

        // Apply area filter in app layer
        if (filters?.area) {
            const searchTerm = filters.area.toLowerCase();
            resultData = resultData.filter(r =>
                r.area_name.toLowerCase().includes(searchTerm)
            );
        }

        // Sort in app layer
        // If no sort column specified, sort by area_index (default area order) then commessa
        const sortColumn = sort?.column || 'display_order';
        const sortDirection = sort?.direction || 'asc';
        
        resultData.sort((a, b) => {
            let aVal: string | number;
            let bVal: string | number;

            if (sortColumn === 'display_order') {
                // Primary sort: Commessa (Ascending - chronological by number)
                if (a.commessa_display !== b.commessa_display) {
                    return a.commessa_display.localeCompare(b.commessa_display);
                }
                // Secondary sort: Area Index (Ascending - production flow)
                return a.area_index - b.area_index;
            }

            if (sortColumn === 'area') {
                aVal = a.area_name;
                bVal = b.area_name;
            } else if (sortColumn === 'time') {
                aVal = a.work_time;
                bVal = b.work_time;
            } else if (sortColumn === 'qty_requested') {
                aVal = a.qty_requested ?? 0;
                bVal = b.qty_requested ?? 0;
            } else if (sortColumn === 'pages') {
                aVal = (a as any).pages ?? 0;
                bVal = (b as any).pages ?? 0;
            } else if (sortColumn === 'composition') {
                aVal = (a as any).composition ?? '';
                bVal = (b as any).composition ?? '';
            } else if (sortColumn === 'fogli') {
                aVal = (a as any).fogli ?? 0;
                bVal = (b as any).fogli ?? 0;
            } else if (sortColumn === 'client_name') {
                aVal = a.client_name ?? '';
                bVal = b.client_name ?? '';
            } else {
                // Default: commessa
                aVal = a.commessa_display;
                bVal = b.commessa_display;
            }

            if (typeof aVal === 'string') {
                return sortDirection === 'asc'
                    ? aVal.localeCompare(bVal as string)
                    : (bVal as string).localeCompare(aVal);
            }
            return sortDirection === 'asc' ? aVal - (bVal as number) : (bVal as number) - aVal;
        });

        const total = resultData.length;

        // Apply pagination in app layer
        const offset = calculateOffset(page, limit);
        const paginatedData = exportAll ? resultData : resultData.slice(offset, offset + limit);

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
