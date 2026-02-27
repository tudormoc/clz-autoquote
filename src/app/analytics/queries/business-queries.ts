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
 * SPLIT REVENUE TOGGLE:
 * - When includeAllRevenueForSplit is TRUE, orders with split revenue (invoices
 *   outside date range) will show ALL revenue instead of just period revenue
 * - This allows seeing true profitability for orders that span multiple periods
 * 
 * GROUPING: By 4-digit commessa code
 * - Multiple revisions of same order are grouped together
 * - Display shows 4-digit code for readability
 * 
 * FILTERS:
 * - Date range (applied to revenue only, unless toggle is ON)
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
        includeAllRevenueForSplit?: boolean;
    },
    sort?: SortConfig,
    exportAll: boolean = false
) {
    try {
        const offset = calculateOffset(page, limit);
        const { startDate, endDate } = setupDateParams(year, filters?.dateFrom, filters?.dateTo);
        const includeAllRevenue = filters?.includeAllRevenueForSplit || false;

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

        // Build conditional CTE for all-time revenue (only when toggle is ON)
        const allTimeRevenueCTE = includeAllRevenue ? `,
            OrdersInPeriod AS (
                SELECT DISTINCT dw.dw_commeca
                FROM dwarehe dw WITH (NOLOCK)
                INNER JOIN anagra an WITH (NOLOCK)
                    ON dw.dw_conto = an.an_conto
                    AND dw.codditt = an.codditt
                WHERE ${whereClause}
                  AND an.an_tipo = 'C'
                  AND dw.dw_valfatt > 0
            ),
            AllTimeRevenue AS (
                SELECT 
                    RIGHT(CAST(dw.dw_commeca / 100 AS VARCHAR), 4) as commessa_display,
                    SUM(dw.dw_valfatt) as all_time_revenue
                FROM dwarehe dw WITH (NOLOCK)
                INNER JOIN anagra an WITH (NOLOCK)
                    ON dw.dw_conto = an.an_conto
                    AND dw.codditt = an.codditt
                INNER JOIN OrdersInPeriod oip ON dw.dw_commeca = oip.dw_commeca
                WHERE dw.dw_scenario = 1
                  AND dw.codditt = @codditt
                  AND an.an_tipo = 'C'
                  AND dw.dw_valfatt > 0
                GROUP BY RIGHT(CAST(dw.dw_commeca / 100 AS VARCHAR), 4)
            )` : '';

        // Conditional revenue column: use all-time revenue for split orders when toggle is ON
        const revenueColumn = includeAllRevenue 
            ? 'CASE WHEN sr.commessa_display IS NOT NULL THEN ISNULL(atr.all_time_revenue, cr.total_revenue) ELSE cr.total_revenue END as total_revenue'
            : 'cr.total_revenue';

        // Conditional join for all-time revenue
        const allTimeRevenueJoin = includeAllRevenue
            ? 'LEFT JOIN AllTimeRevenue atr ON cr.commessa_display = atr.commessa_display'
            : '';

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
                SELECT DISTINCT RIGHT(CAST(dw.dw_commeca / 100 AS VARCHAR), 4) as commessa_display
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
            )${allTimeRevenueCTE}
            SELECT 
                RIGHT(CAST(cr.commessa_full / 100 AS VARCHAR), 4) as commessa_display,
                cr.commessa_full,
                co.co_descr1 as order_description,
                cr.client_code,
                cr.client_name,
                ${revenueColumn},
                ISNULL(sc.total_cost, 0) as total_cost,
                cr.total_quantity,
                CASE WHEN sr.commessa_display IS NOT NULL THEN 1 ELSE 0 END as has_split_revenue
            FROM ClientRevenue cr
            LEFT JOIN SupplierCosts sc ON cr.commessa_display = sc.commessa_display
            LEFT JOIN SplitRevenue sr ON cr.commessa_display = sr.commessa_display
            ${allTimeRevenueJoin}
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


/**
 * ============================================================================
 * CLIENT SUMMARY REPORT (WITH SPLIT REVENUE TOGGLE)
 * ============================================================================
 * 
 * Shows aggregated revenue, costs, and margin per client.
 * Includes toggle to show full revenue for orders with split invoices.
 * 
 * SPLIT REVENUE TOGGLE:
 * - When OFF: Shows only revenue from invoices in the selected period
 * - When ON: Shows all-time revenue for orders that have invoices in the period
 * 
 * This allows seeing true profitability for orders that span multiple periods.
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
        includeAllRevenueForSplit?: boolean;
    },
    sort?: SortConfig,
    exportAll: boolean = false
) {
    try {
        const offset = calculateOffset(page, limit);
        const { startDate, endDate } = setupDateParams(year, filters?.dateFrom, filters?.dateTo);
        const includeAllRevenue = filters?.includeAllRevenueForSplit || false;

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

        // Build conditional CTE for all-time revenue (only when toggle is ON)
        // Logic: Calculate difference between period and all-time revenue for orders only
        const allTimeRevenueCTE = includeAllRevenue ? `,
            OrdersInPeriod AS (
                SELECT DISTINCT dw.dw_commeca
                FROM dwarehe dw WITH (NOLOCK)
                INNER JOIN anagra an WITH (NOLOCK)
                    ON dw.dw_conto = an.an_conto
                    AND dw.codditt = an.codditt
                WHERE ${whereClause}
                  AND an.an_tipo = 'C'
                  AND dw.dw_valfatt > 0
                  AND dw.dw_commeca > 0
            ),
            AllTimeRevenueByOrder AS (
                SELECT 
                    RIGHT(CAST(dw.dw_commeca / 100 AS VARCHAR), 4) as commessa_display,
                    MIN(an.an_conto) as client_code,
                    SUM(dw.dw_valfatt) as order_all_time_revenue
                FROM dwarehe dw WITH (NOLOCK)
                INNER JOIN anagra an WITH (NOLOCK)
                    ON dw.dw_conto = an.an_conto
                    AND dw.codditt = an.codditt
                INNER JOIN OrdersInPeriod oip ON dw.dw_commeca = oip.dw_commeca
                WHERE dw.dw_scenario = 1
                  AND dw.codditt = @codditt
                  AND an.an_tipo = 'C'
                  AND dw.dw_valfatt > 0
                GROUP BY RIGHT(CAST(dw.dw_commeca / 100 AS VARCHAR), 4)
            ),
            PeriodRevenueByOrder AS (
                SELECT 
                    RIGHT(CAST(dw.dw_commeca / 100 AS VARCHAR), 4) as commessa_display,
                    MIN(an.an_conto) as client_code,
                    SUM(dw.dw_valfatt) as order_period_revenue
                FROM dwarehe dw WITH (NOLOCK)
                INNER JOIN anagra an WITH (NOLOCK)
                    ON dw.dw_conto = an.an_conto
                    AND dw.codditt = an.codditt
                INNER JOIN OrdersInPeriod oip ON dw.dw_commeca = oip.dw_commeca
                WHERE ${whereClause}
                  AND an.an_tipo = 'C'
                  AND dw.dw_valfatt > 0
                GROUP BY RIGHT(CAST(dw.dw_commeca / 100 AS VARCHAR), 4)
            ),
            RevenueAdjustment AS (
                SELECT 
                    atr.client_code,
                    SUM(atr.order_all_time_revenue - ISNULL(pr.order_period_revenue, 0)) as revenue_adjustment
                FROM AllTimeRevenueByOrder atr
                LEFT JOIN PeriodRevenueByOrder pr ON atr.commessa_display = pr.commessa_display AND atr.client_code = pr.client_code
                GROUP BY atr.client_code
            ),
            SplitClients AS (
                SELECT DISTINCT an.an_conto as client_code
                FROM dwarehe dw WITH (NOLOCK)
                INNER JOIN anagra an WITH (NOLOCK)
                    ON dw.dw_conto = an.an_conto
                    AND dw.codditt = an.codditt
                INNER JOIN OrdersInPeriod oip ON dw.dw_commeca = oip.dw_commeca
                WHERE dw.dw_scenario = 1
                  AND dw.codditt = @codditt
                  AND an.an_tipo = 'C'
                  AND dw.dw_valfatt > 0
                  AND (dw.dw_datmov < @startDate OR dw.dw_datmov > @endDate)
            )` : '';

        // Conditional revenue column: add the adjustment (all-time - period) for orders
        const revenueColumn = includeAllRevenue 
            ? 'CASE WHEN MAX(sc_check.client_code) IS NOT NULL THEN (cr.total_revenue + ISNULL(MAX(ra.revenue_adjustment), 0)) ELSE cr.total_revenue END as total_revenue'
            : 'cr.total_revenue';

        // Conditional joins for all-time revenue
        const allTimeRevenueJoins = includeAllRevenue
            ? `LEFT JOIN RevenueAdjustment ra ON cr.client_code = ra.client_code
            LEFT JOIN SplitClients sc_check ON cr.client_code = sc_check.client_code`
            : '';

        // Get paginated data
        const result = await queryMSSQL(`
            WITH ClientRevenue AS (
                SELECT 
                    an.an_conto as client_code,
                    an.an_descr1 as client_name,
                    COUNT(DISTINCT CASE WHEN dw.dw_commeca > 0 THEN RIGHT(CAST(dw.dw_commeca / 100 AS VARCHAR), 4) END) as total_orders,
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
            )${allTimeRevenueCTE}
            SELECT 
                cr.client_code,
                cr.client_name,
                cr.total_orders,
                ${revenueColumn},
                ISNULL(SUM(sc.commessa_cost), 0) as total_cost,
                cr.total_quantity,
                ISNULL(sr.split_count, 0) as split_orders_count
            FROM ClientRevenue cr
            LEFT JOIN ClientCommessas cc ON cr.client_code = cc.client_code
            LEFT JOIN SupplierCosts sc ON cc.dw_commeca = sc.dw_commeca
            LEFT JOIN SplitRevenue sr ON cr.client_code = sr.client_code
            ${allTimeRevenueJoins}
            GROUP BY cr.client_code, cr.client_name, cr.total_orders, cr.total_revenue, cr.total_quantity, ISNULL(sr.split_count, 0)
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




