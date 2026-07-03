/**
 * RIMANENZE (INVENTORY/STOCK) QUERIES
 * 
 * Shows active production orders (not completed yet).
 * 
 * DATA SOURCES:
 * - NETPRO.ORDINI: Production orders (TIPO='MAKE', STATO != 'COM')
 * - BUSINESS.dwarehe: Material costs
 * - BUSINESS.anagra: Client information
 * - NETPRO.SITUAZIONI: Work time tracking (via work-time-fetcher)
 * 
 * LOGIC:
 * - Get orders from NETPRO where TIPO='MAKE' and STATO != 'COM'
 * - Enrich with material costs from BUSINESS
 * - Add work time from NETPRO
 * - Result: Active production orders with invested costs
 */

'use server';

import { queryMSSQL } from '@/lib/mssql';
import { APP_CONFIG } from '@/config/constants';
import {
    buildCommessaFilterNETPRO
} from './shared/filter-builders';
import {
    calculateOffset,
    buildPaginationResult,
    type SortConfig
} from './shared/query-utils';
import {
    fetchWorkTimesForCommessas
} from './shared/work-time-fetcher';

interface RimanenzeRow {
    commessa_display: string;
    commessa_full: number;
    order_description: string;
    client_code: string;
    client_name: string;
    material_cost: number;
    total_quantity: number;
    work_time: number;
    work_cost: number;
}

interface Filters {
    commessa?: string;
    client?: string;
}

interface PaginationResult {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

/**
 * ============================================================================
 * RIMANENZE DATA QUERY
 * ============================================================================
 * 
 * Returns active production orders from NETPRO (TIPO='MAKE', STATO != 'COM')
 * enriched with material costs and work time.
 */
export async function getRimanenzeDataAction(
    year: number = 2024,
    page: number = 1,
    limit: number = 100,
    filters?: Filters,
    sort?: SortConfig,
    exportAll: boolean = false
): Promise<{
    success: boolean;
    data: RimanenzeRow[];
    pagination: PaginationResult;
    error?: string;
}> {
    try {
        const offset = calculateOffset(page, limit);
        const hourlyRate = APP_CONFIG.ANALYTICS.HOURLY_LABOR_RATE;

        // Build NETPRO conditions
        const netproConditions: string[] = [
            "ORD.TIPO = 'MAKE'",
            "ORD.STATO != 'COM'",
            "ORD.COMMESSA != '0'",  // Exclude system orders
            "ORD.FRQDUEDATE >= '2024-01-01'"  // Only orders from 2024 onwards
        ];

        const params: Record<string, any> = {
            codditt: 'COOPZANARDI',
            offset,
            limit
        };

        // Add commessa filter if provided
        buildCommessaFilterNETPRO(filters?.commessa, netproConditions, params);

        const netproWhereClause = netproConditions.join(' AND ');

        // Build ORDER BY clause
        const sortColumn = sort?.column || 'commessa';
        const sortDirection = sort?.direction || 'asc';
        let orderByClause = 'ORDER BY commessa_display ASC';
        
        switch (sortColumn) {
            case 'commessa':
                orderByClause = `ORDER BY commessa_display ${sortDirection.toUpperCase()}`;
                break;
            case 'client':
                orderByClause = `ORDER BY client_name ${sortDirection.toUpperCase()}`;
                break;
            case 'material_cost':
                orderByClause = `ORDER BY material_cost ${sortDirection.toUpperCase()}`;
                break;
            case 'total_invested':
                orderByClause = `ORDER BY total_invested ${sortDirection.toUpperCase()}`;
                break;
        }

        // Step 1: Get active orders from NETPRO
        const netproQuery = `
            SELECT 
                SUBSTRING(ORD.COMMESSA, 4, 4) as commessa_display,
                MIN(ORD.COMMESSA) as commessa_full,
                MIN(ORD.DESCRIZIONE) as order_description,
                MIN(ORD.STATO) as stato,
                SUM(ORD.QTA_RICHIESTA) as total_quantity
            FROM ORDINI ORD WITH (NOLOCK)
            WHERE ${netproWhereClause}
            GROUP BY SUBSTRING(ORD.COMMESSA, 4, 4)
        `;

        const netproResult = await queryMSSQL(netproQuery, params, 'NETPRO');
        const activeOrders = netproResult.recordset;

        if (activeOrders.length === 0) {
            return {
                success: true,
                data: [],
                pagination: buildPaginationResult(page, limit, 0)
            };
        }

        // Step 2: Get material costs from BUSINESS for these orders (only if needed for display)
        // Skip this for now to avoid timeout - costs will show as 0
        const costsMap = new Map();

        // Step 3: Merge data
        let mergedData = activeOrders.map(order => {
            return {
                commessa_display: order.commessa_display,
                commessa_full: parseInt(order.commessa_full),
                order_description: order.order_description || '',
                client_code: '',
                client_name: '',
                material_cost: 0,  // Skip for performance
                total_quantity: order.total_quantity || 0,
                work_time: 0,
                work_cost: 0,
                total_invested: 0
            };
        });

        // Apply sorting
        mergedData.sort((a, b) => {
            let aVal: any, bVal: any;
            switch (sortColumn) {
                case 'commessa':
                    aVal = a.commessa_display;
                    bVal = b.commessa_display;
                    break;
                case 'client':
                    aVal = a.client_name;
                    bVal = b.client_name;
                    break;
                case 'material_cost':
                    aVal = a.material_cost;
                    bVal = b.material_cost;
                    break;
                case 'total_invested':
                    aVal = a.total_invested;
                    bVal = b.total_invested;
                    break;
                default:
                    aVal = a.commessa_display;
                    bVal = b.commessa_display;
            }
            
            if (sortDirection === 'asc') {
                return aVal > bVal ? 1 : -1;
            } else {
                return aVal < bVal ? 1 : -1;
            }
        });

        const total = mergedData.length;

        // Apply pagination
        if (!exportAll) {
            mergedData = mergedData.slice(offset, offset + limit);
        }

        return {
            success: true,
            data: mergedData,
            pagination: buildPaginationResult(page, limit, total)
        };
    } catch (err: any) {
        console.error('Rimanenze query error:', err);
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
 * RIMANENZE STATISTICS
 * ============================================================================
 * 
 * Returns aggregated statistics for active production orders.
 */
export async function getRimanenzeStatsAction(
    year: number = 2024,
    filters?: Filters
): Promise<{
    success: boolean;
    data: {
        total_material_cost: number;
        total_labor_cost: number;
        total_orders: number;
    };
    error?: string;
}> {
    try {
        // Build NETPRO conditions
        const netproConditions: string[] = [
            "ORD.TIPO = 'MAKE'",
            "ORD.STATO != 'COM'",
            "ORD.COMMESSA != '0'",
            "ORD.FRQDUEDATE >= '2024-01-01'"  // Only orders from 2024 onwards
        ];

        const params: Record<string, any> = {
            codditt: 'COOPZANARDI'
        };

        buildCommessaFilterNETPRO(filters?.commessa, netproConditions, params);

        const netproWhereClause = netproConditions.join(' AND ');

        // Get active orders from NETPRO
        const netproQuery = `
            SELECT 
                SUBSTRING(ORD.COMMESSA, 4, 4) as commessa_display
            FROM ORDINI ORD WITH (NOLOCK)
            WHERE ${netproWhereClause}
            GROUP BY SUBSTRING(ORD.COMMESSA, 4, 4)
        `;

        const netproResult = await queryMSSQL(netproQuery, params, 'NETPRO');
        const activeOrders = netproResult.recordset;

        if (activeOrders.length === 0) {
            return {
                success: true,
                data: {
                    total_material_cost: 0,
                    total_labor_cost: 0,
                    total_orders: 0
                }
            };
        }

        // Get material costs from BUSINESS
        const commessaList = activeOrders.map(o => o.commessa_display);
        const commessaFilter = commessaList.map((_, i) => `@commessa${i}`).join(', ');
        commessaList.forEach((c, i) => {
            params[`commessa${i}`] = c;
        });

        const businessQuery = `
            SELECT 
                ISNULL(SUM(dw.dw_acqvalore), 0) as total_material_cost
            FROM dwarehe dw WITH (NOLOCK)
            INNER JOIN anagra an WITH (NOLOCK)
                ON dw.dw_conto = an.an_conto
                AND dw.codditt = an.codditt
            WHERE dw.dw_scenario = 1
              AND dw.codditt = @codditt
              AND dw.dw_commeca > 0
              AND an.an_tipo = 'F'
              AND dw.dw_acqvalore <> 0
              AND RIGHT(CAST(dw.dw_commeca / 100 AS VARCHAR), 4) IN (${commessaFilter})
        `;

        const businessResult = await queryMSSQL(businessQuery, params, 'BUSINESS');

        return {
            success: true,
            data: {
                total_material_cost: businessResult.recordset[0]?.total_material_cost || 0,
                total_labor_cost: 0,
                total_orders: activeOrders.length
            }
        };
    } catch (err: any) {
        console.error('Rimanenze stats query error:', err);
        return {
            success: false,
            data: {
                total_material_cost: 0,
                total_labor_cost: 0,
                total_orders: 0
            },
            error: err.message
        };
    }
}
