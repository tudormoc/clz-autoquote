/**
 * BUSINESS Database Queries
 * 
 * Complex queries that use BUSINESS database (revenue/costs) and
 * cross-reference with NETPRO database (work times).
 * 
 * DATA SOURCES:
 * - BUSINESS.dwarehe: Revenue and material costs
 * - BUSINESS.anagra: Client/supplier information
 * - BUSINESS.commess: Order descriptions
 * - NETPRO.SITUAZIONI: Work time tracking (via work-time-fetcher)
 * 
 * COST CALCULATION LOGIC:
 * - Material costs: From supplier rows (an_tipo='F') using dw_acqvalore
 * - Labor costs: Work hours from NETPRO × hourly rate from config
 * - Costs include ALL historical data for each commessa (not date-filtered)
 * - Revenue is date-filtered to show only invoices in selected period
 */

'use server'

import { queryMSSQL } from '@/lib/mssql';
import {
    buildCommessaFilterBUSINESS,
    buildClientFilter,
    buildClientFilterForOrderRevenue
} from './shared/filter-builders';
import {
    calculateOffset,
    buildPaginationResult,
    buildClientSummaryOrderBy,
    buildOrderRevenueOrderBy,
    transformOrderByForCTE,
    setupDateParams,
    buildPostCTECommessaFilter,
    type SortConfig
} from './shared/query-utils';
import {
    fetchWorkTimesForCommessas,
    fetchWorkCostsForClients
} from './shared/work-time-fetcher';

/**
 * ============================================================================
 * CLIENT SUMMARY REPORT
 * ============================================================================
 * 
 * Shows aggregated revenue, costs, and margin per client.
 * 
 * CALCULATION LOGIC:
 * 1. Get client revenue from date-filtered invoices (an_tipo='C')
 * 2. Get ALL material costs for those commessas (an_tipo='F', no date filter)
 * 3. Get ALL work times from NETPRO for those commessas (no date filter)
 * 4. Calculate: Margin = Revenue - Material Cost - Labor Cost
 * 
 * WHY NO DATE FILTER ON COSTS:
 * If an order was invoiced in 2025 but materials were purchased in 2024 and
 * work was done in 2024, we still need to include those 2024 costs to calculate
 * true profitability of the order. This gives accurate margin per order.
 * 
 * DATE FILTER BEHAVIOR:
 * - Revenue: Only invoices in selected date range ✅
 * - Orders: Only orders with invoices in date range ✅
 * - Quantity: Only quantities from invoices in date range ✅
 * - Material Cost: ALL historical costs for those orders ❌
 * - Work Cost: ALL historical work for those orders ❌
 * 
 * PERFORMANCE: Moderate - requires 3 queries (revenue, costs, work times)
 * ============================================================================
 */
export async function getClientSummaryDataAction(
    year: number = 2024,
    page: number = 1,
    limit: number = 100,
    filters?: {
        client?: string;
        dateFrom?: string;
        dateTo?: string;
    },
    sort?: SortConfig,
    exportAll: boolean = false
) {
    try {
        const offset = calculateOffset(page, limit);
        const { startDate, endDate } = setupDateParams(year, filters?.dateFrom, filters?.dateTo);

        // Build WHERE conditions
        const conditions: string[] = [
            'dw.dw_scenario = 1',
            'dw.codditt = @codditt',
            'dw.dw_anno >= @year',
            'dw.dw_datmov >= @startDate',
            'dw.dw_datmov <= @endDate'
        ];

        const params: Record<string, any> = {
            codditt: 'COOPZANARDI',
            year,
            startDate,
            endDate,
            offset,
            limit
        };

        // Apply client filter using shared utility
        buildClientFilter(filters?.client, conditions, params);

        const whereClause = conditions.join(' AND ');

        // Build ORDER BY clause
        const orderByClause = buildClientSummaryOrderBy(
            sort?.column || 'revenue',
            sort?.direction || 'desc'
        );

        // Get total count for pagination
        const countResult = await queryMSSQL(`
            SELECT COUNT(DISTINCT an.an_conto) as total
            FROM dwarehe dw WITH (NOLOCK)
            INNER JOIN anagra an WITH (NOLOCK) 
                ON dw.dw_conto = an.an_conto 
                AND dw.codditt = an.codditt
            WHERE ${whereClause}
              AND an.an_tipo = 'C'
              AND dw.dw_valfatt > 0
        `, params, 'BUSINESS');

        const total = countResult.recordset[0].total;

        // Get paginated data - first get client revenue, then join with supplier costs by commessa
        const result = await queryMSSQL(`
            WITH ClientRevenue AS (
                SELECT 
                    an.an_conto as client_code,
                    an.an_descr1 as client_name,
                    COUNT(DISTINCT dw.dw_commeca) as total_orders,
                    SUM(dw.dw_valfatt) as total_revenue,
                    SUM(dw.dw_collifatt) as total_quantity
                FROM dwarehe dw WITH (NOLOCK)
                INNER JOIN anagra an WITH (NOLOCK) 
                    ON dw.dw_conto = an.an_conto 
                    AND dw.codditt = an.codditt
                WHERE ${whereClause}
                  AND an.an_tipo = 'C'
                  AND dw.dw_valfatt > 0
                GROUP BY an.an_conto, an.an_descr1
            ),
            SupplierCosts AS (
                SELECT 
                    dw.dw_commeca,
                    SUM(dw.dw_acqvalore) as commessa_cost
                FROM dwarehe dw WITH (NOLOCK)
                INNER JOIN anagra an WITH (NOLOCK)
                    ON dw.dw_conto = an.an_conto
                    AND dw.codditt = an.codditt
                WHERE dw.dw_scenario = 1
                  AND dw.codditt = @codditt
                  AND an.an_tipo = 'F'
                  AND dw.dw_acqvalore <> 0
                  AND dw.dw_commeca > 0
                GROUP BY dw.dw_commeca
            ),
            ClientCommessas AS (
                SELECT DISTINCT
                    an.an_conto as client_code,
                    dw.dw_commeca
                FROM dwarehe dw WITH (NOLOCK)
                INNER JOIN anagra an WITH (NOLOCK)
                    ON dw.dw_conto = an.an_conto
                    AND dw.codditt = an.codditt
                WHERE ${whereClause}
                  AND an.an_tipo = 'C'
                  AND dw.dw_valfatt > 0
                  AND dw.dw_commeca > 0
            ),
            SplitRevenue AS (
                SELECT 
                    an.an_conto as client_code,
                    COUNT(DISTINCT dw.dw_commeca) as split_count
                FROM dwarehe dw WITH (NOLOCK)
                INNER JOIN anagra an WITH (NOLOCK)
                    ON dw.dw_conto = an.an_conto
                    AND dw.codditt = an.codditt
                WHERE dw.dw_scenario = 1
                  AND dw.codditt = @codditt
                  AND an.an_tipo = 'C'
                  AND dw.dw_valfatt > 0
                  AND dw.dw_commeca > 0
                  AND (dw.dw_datmov < @startDate OR dw.dw_datmov > @endDate)
                GROUP BY an.an_conto
            )
            SELECT 
                cr.client_code,
                cr.client_name,
                cr.total_orders,
                cr.total_revenue,
                ISNULL(SUM(sc.commessa_cost), 0) as total_cost,
                cr.total_quantity,
                ISNULL(sr.split_count, 0) as split_orders_count
            FROM ClientRevenue cr
            LEFT JOIN ClientCommessas cc ON cr.client_code = cc.client_code
            LEFT JOIN SupplierCosts sc ON cc.dw_commeca = sc.dw_commeca
            LEFT JOIN SplitRevenue sr ON cr.client_code = sr.client_code
            GROUP BY cr.client_code, cr.client_name, cr.total_orders, cr.total_revenue, cr.total_quantity, sr.split_count
            ORDER BY ${orderByClause}
            ${exportAll ? '' : 'OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY'}
        `, params, 'BUSINESS');

        // Get work time from NETPRO for all commessas linked to these clients
        const clientCodes = result.recordset.map(row => row.client_code);
        const { APP_CONFIG } = await import('@/config/constants');
        const hourlyRate = APP_CONFIG.ANALYTICS.HOURLY_LABOR_RATE;

        const workCosts = await fetchWorkCostsForClients(
            clientCodes,
            year,
            startDate,
            endDate,
            hourlyRate
        );

        // Merge work costs into result
        const enrichedData = result.recordset.map(row => ({
            ...row,
            work_cost: workCosts[row.client_code] || 0
        }));

        return {
            success: true,
            data: enrichedData,
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
 * ORDER REVENUE REPORT
 * ============================================================================
 * 
 * Shows revenue, costs, and margin per order (commessa).
 * 
 * CALCULATION LOGIC:
 * 1. Get revenue per commessa from date-filtered invoices
 * 2. Get ALL material costs for those commessas (no date filter)
 * 3. Get ALL work times from NETPRO for those commessas (no date filter)
 * 4. Calculate: Margin = Revenue - Material Cost - Labor Cost
 * 
 * WHY NO DATE FILTER ON COSTS:
 * If an order was invoiced in 2025 but materials were purchased in 2024 and
 * work was done in 2024, we still need to include those 2024 costs to calculate
 * true profitability of the order.
 * 
 * DATE FILTER BEHAVIOR:
 * - Revenue: Only invoices in selected date range ✅
 * - Quantity: Only quantities from invoices in date range ✅
 * - Material Cost: ALL historical costs for those orders ❌
 * - Work Cost: ALL historical work for those orders ❌
 * 
 * GROUPING: By full commessa number (dw_commeca)
 * - This ensures each unique order is a separate row
 * - Display shows 4-digit code for readability
 * 
 * FILTERS:
 * - Date range (applied to revenue only)
 * - Commessa code or description (fuzzy search)
 * - Client code or name (fuzzy search)
 * 
 * PERFORMANCE: Moderate - requires 2 queries (revenue+costs, work times)
 * ============================================================================
 */
export async function getOrderRevenueDataAction(
    year: number = 2024,
    page: number = 1,
    limit: number = 100,
    filters?: {
        commessa?: string;
        client?: string;
        dateFrom?: string;
        dateTo?: string;
    },
    sort?: SortConfig,
    exportAll: boolean = false
) {
    try {
        const offset = calculateOffset(page, limit);
        const { startDate, endDate } = setupDateParams(year, filters?.dateFrom, filters?.dateTo);

        // Build WHERE conditions
        const conditions: string[] = [
            'dw.dw_scenario = 1',
            'dw.codditt = @codditt',
            'dw.dw_anno >= @year',
            'dw.dw_datmov >= @startDate',
            'dw.dw_datmov <= @endDate',
            'dw.dw_commeca > 0'
        ];

        const params: Record<string, any> = {
            codditt: 'COOPZANARDI',
            year,
            startDate,
            endDate,
            offset,
            limit
        };

        // Apply filters using shared utilities
        // Skip single-term commessa filter in WHERE clause - it will be applied post-CTE to allow description search
        buildCommessaFilterBUSINESS(filters?.commessa, conditions, params, true);
        buildClientFilterForOrderRevenue(filters?.client, conditions, params);

        const whereClause = conditions.join(' AND ');

        // Build ORDER BY clause
        const rawOrderByClause = buildOrderRevenueOrderBy(
            sort?.column || 'revenue',
            sort?.direction || 'desc'
        );

        // Get total count for pagination
        const countResult = await queryMSSQL(`
            SELECT COUNT(DISTINCT RIGHT(CAST(dw.dw_commeca / 100 AS VARCHAR), 4)) as total
            FROM dwarehe dw WITH (NOLOCK)
            INNER JOIN anagra an WITH (NOLOCK) 
                ON dw.dw_conto = an.an_conto 
                AND dw.codditt = an.codditt
            WHERE ${whereClause}
              AND an.an_tipo = 'C'
              AND dw.dw_valfatt > 0
        `, params, 'BUSINESS');

        const total = countResult.recordset[0].total;

        // Build post-CTE filter for commessa description search
        const postCTEFilter = buildPostCTECommessaFilter(filters?.commessa, params);

        // Transform ORDER BY for use after CTE
        const orderByClause = transformOrderByForCTE(rawOrderByClause);

        // Get paginated data with revenue AND material costs in one query
        // Use CTE to separate client revenue from supplier costs
        const result = await queryMSSQL(`
            WITH ClientRevenue AS (
                SELECT 
                    RIGHT(CAST(dw.dw_commeca / 100 AS VARCHAR), 4) as commessa_display,
                    MIN(dw.dw_commeca) as commessa_full,
                    MIN(an.an_conto) as client_code,
                    MAX(an.an_descr1) as client_name,
                    SUM(dw.dw_valfatt) as total_revenue,
                    SUM(dw.dw_collifatt) as total_quantity
                FROM dwarehe dw WITH (NOLOCK)
                INNER JOIN anagra an WITH (NOLOCK) 
                    ON dw.dw_conto = an.an_conto 
                    AND dw.codditt = an.codditt
                WHERE ${whereClause}
                  AND an.an_tipo = 'C'
                  AND dw.dw_valfatt > 0
                GROUP BY RIGHT(CAST(dw.dw_commeca / 100 AS VARCHAR), 4)
            ),
            SupplierCosts AS (
                SELECT 
                    RIGHT(CAST(dw.dw_commeca / 100 AS VARCHAR), 4) as commessa_display,
                    SUM(dw.dw_acqvalore) as total_cost
                FROM dwarehe dw WITH (NOLOCK)
                INNER JOIN anagra an WITH (NOLOCK)
                    ON dw.dw_conto = an.an_conto
                    AND dw.codditt = an.codditt
                WHERE dw.dw_scenario = 1
                  AND dw.codditt = @codditt
                  AND an.an_tipo = 'F'
                  AND dw.dw_acqvalore <> 0
                  AND dw.dw_commeca > 0
                GROUP BY RIGHT(CAST(dw.dw_commeca / 100 AS VARCHAR), 4)
            ),
            SplitRevenue AS (
                SELECT DISTINCT dw.dw_commeca
                FROM dwarehe dw WITH (NOLOCK)
                INNER JOIN anagra an WITH (NOLOCK)
                    ON dw.dw_conto = an.an_conto
                    AND dw.codditt = an.codditt
                WHERE dw.dw_scenario = 1
                  AND dw.codditt = @codditt
                  AND an.an_tipo = 'C'
                  AND dw.dw_valfatt > 0
                  AND dw.dw_commeca > 0
                  AND (dw.dw_datmov < @startDate OR dw.dw_datmov > @endDate)
            )
            SELECT 
                RIGHT(CAST(cr.commessa_full / 100 AS VARCHAR), 4) as commessa_display,
                cr.commessa_full,
                co.co_descr1 as order_description,
                cr.client_code,
                cr.client_name,
                cr.total_revenue,
                ISNULL(sc.total_cost, 0) as total_cost,
                cr.total_quantity,
                CASE WHEN sr.dw_commeca IS NOT NULL THEN 1 ELSE 0 END as has_split_revenue
            FROM ClientRevenue cr
            LEFT JOIN SupplierCosts sc ON cr.commessa_display = sc.commessa_display
            LEFT JOIN SplitRevenue sr ON RIGHT(CAST(sr.dw_commeca / 100 AS VARCHAR), 4) = cr.commessa_display
            LEFT JOIN commess co WITH (NOLOCK)
                ON cr.commessa_full = co.co_comme
                AND co.codditt = @codditt
            ${postCTEFilter}
            ORDER BY ${orderByClause}
            ${exportAll ? '' : 'OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY'}
        `, params, 'BUSINESS');

        // Get work time from NETPRO for all commessa codes in the result
        const commessaCodesForTime = result.recordset.map(row => row.commessa_display);
        const workTimes = await fetchWorkTimesForCommessas(commessaCodesForTime);

        // Merge work times and calculate work costs
        const { APP_CONFIG } = await import('@/config/constants');
        const hourlyRate = APP_CONFIG.ANALYTICS.HOURLY_LABOR_RATE;

        const enrichedData = result.recordset.map(row => ({
            ...row,
            work_time: workTimes[row.commessa_display] || 0,
            work_cost: (workTimes[row.commessa_display] || 0) * hourlyRate
        }));

        return {
            success: true,
            data: enrichedData,
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
