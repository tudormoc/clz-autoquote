/**
 * RIMANENZE LABOR (WORK TIME) QUERIES
 * 
 * Shows active production orders (same as rimanenze-queries.ts).
 * 
 * DATA SOURCES:
 * - NETPRO.ORDINI: Production orders (TIPO='MAKE', STATO != 'COM')
 * 
 * LOGIC:
 * - Get orders from NETPRO where TIPO='MAKE' and STATO != 'COM'
 * - Same list as main rimanenze dashboard
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

interface RimanenzeLaborRow {
    commessa_display: string;
    commessa_full: string;
    order_description: string;
    work_time: number;
    work_cost: number;
}

interface Filters {
    commessa?: string;
}

interface PaginationResult {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

/**
 * ============================================================================
 * RIMANENZE LABOR DATA QUERY
 * ============================================================================
 * 
 * Returns active production orders from NETPRO (same as rimanenze).
 */
export async function getRimanenzeLaborDataAction(
    year: number = 2024,
    page: number = 1,
    limit: number = 100,
    filters?: Filters,
    sort?: SortConfig,
    exportAll: boolean = false
): Promise<{
    success: boolean;
    data: RimanenzeLaborRow[];
    pagination: PaginationResult;
    error?: string;
}> {
    try {
        const offset = calculateOffset(page, limit);

        // Build NETPRO conditions (same as rimanenze-queries.ts)
        const netproConditions: string[] = [
            "ORD.TIPO = 'MAKE'",
            "ORD.STATO != 'COM'",
            "ORD.COMMESSA != '0'",
            "ORD.FRQDUEDATE >= '2024-01-01'"
        ];

        const params: Record<string, any> = {
            offset,
            limit
        };

        buildCommessaFilterNETPRO(filters?.commessa, netproConditions, params);

        const netproWhereClause = netproConditions.join(' AND ');

        // Get active orders from NETPRO
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

        // Build data (no costs for now)
        let mergedData = activeOrders.map((order: any) => ({
            commessa_display: order.commessa_display,
            commessa_full: order.commessa_full,
            order_description: order.order_description || '',
            work_time: 0,
            work_cost: 0
        }));

        // Apply sorting
        const sortColumn = sort?.column || 'commessa';
        const sortDirection = sort?.direction || 'asc';
        
        mergedData.sort((a, b) => {
            let aVal: any, bVal: any;
            switch (sortColumn) {
                case 'commessa':
                    aVal = a.commessa_display;
                    bVal = b.commessa_display;
                    break;
                case 'work_time':
                    aVal = a.work_time;
                    bVal = b.work_time;
                    break;
                case 'work_cost':
                    aVal = a.work_cost;
                    bVal = b.work_cost;
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
        console.error('Rimanenze labor query error:', err);
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
 * RIMANENZE LABOR STATISTICS
 * ============================================================================
 */
export async function getRimanenzeLaborStatsAction(
    year: number = 2024,
    filters?: Filters
): Promise<{
    success: boolean;
    data: {
        total_labor_cost: number;
        total_work_time: number;
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
            "ORD.FRQDUEDATE >= '2024-01-01'"
        ];

        const params: Record<string, any> = {};

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

        return {
            success: true,
            data: {
                total_labor_cost: 0,
                total_work_time: 0,
                total_orders: activeOrders.length
            }
        };
    } catch (err: any) {
        console.error('Rimanenze labor stats query error:', err);
        return {
            success: false,
            data: {
                total_labor_cost: 0,
                total_work_time: 0,
                total_orders: 0
            },
            error: err.message
        };
    }
}
