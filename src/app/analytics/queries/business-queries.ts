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

        // Extended timeout for export (fetches more data)
        const queryTimeout = exportAll ? 30000 : undefined;

        // Main query — ALWAYS uses the fast 4-CTE version (no toggle-specific CTEs).
        // Full revenue adjustment is computed as a lightweight post-processing step,
        // targeting only split clients instead of embedding expensive CTEs that scan
        // the entire dwarehe table for all historical revenue.
        const mainQuery = `
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
            GROUP BY cr.client_code, cr.client_name, cr.total_orders, cr.total_revenue, cr.total_quantity, ISNULL(sr.split_count, 0)
            ORDER BY ${orderByClause}
            OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
        `;

        // Count query (shared by both paths)
        const countQuery = `
            SELECT COUNT(DISTINCT an.an_conto) as total
            FROM dwarehe dw WITH (NOLOCK)
            INNER JOIN anagra an WITH (NOLOCK) 
                ON dw.dw_conto = an.an_conto 
                AND dw.codditt = an.codditt
            WHERE ${whereClause}
              AND an.an_tipo = 'C'
              AND dw.dw_valfatt > 0
        `;

        let allRecords: any[];
        let total: number;

        if (exportAll) {
            // EXPORT PATH: Batch through pages using OFFSET/FETCH for fast execution
            const EXPORT_PAGE_SIZE = 200;

            const countResult = await queryMSSQL(countQuery, params, 'BUSINESS');
            total = countResult.recordset[0].total;

            if (total === 0) {
                allRecords = [];
            } else {
                const totalExportPages = Math.ceil(total / EXPORT_PAGE_SIZE);
                const pagePromises = Array.from({ length: totalExportPages }, (_, i) =>
                    queryMSSQL(mainQuery, {
                        ...params,
                        offset: i * EXPORT_PAGE_SIZE,
                        limit: EXPORT_PAGE_SIZE
                    }, 'BUSINESS', queryTimeout)
                );
                const pageResults = await Promise.all(pagePromises);
                allRecords = pageResults.flatMap(r => r.recordset);
            }
        } else {
            // NORMAL PATH: Count + single page in parallel
            const countPromise = queryMSSQL(countQuery, params, 'BUSINESS');
            const dataPromise = queryMSSQL(mainQuery, params, 'BUSINESS', queryTimeout);
            const [countResult, result] = await Promise.all([countPromise, dataPromise]);
            total = countResult.recordset[0].total;
            allRecords = result.recordset;
        }

        // POST-PROCESSING: Apply full revenue adjustment for split clients (when toggle is ON).
        // Instead of embedding expensive CTEs that scan ALL historical revenue in the main query
        // (causing timeouts), we compute the adjustment as a targeted follow-up query
        // ONLY for clients that actually have split revenue (typically 10-20 out of 200+ clients).
        if (includeAllRevenue && allRecords.length > 0) {
            const splitClientCodes = Array.from(new Set(
                allRecords.filter(r => r.split_orders_count > 0).map(r => r.client_code)
            )) as string[];

            if (splitClientCodes.length > 0) {
                const ADJ_BATCH_SIZE = 30;
                const adjustments: Record<string, number> = {};

                // Batch split clients to keep IN clauses small
                const adjBatches: string[][] = [];
                for (let i = 0; i < splitClientCodes.length; i += ADJ_BATCH_SIZE) {
                    adjBatches.push(splitClientCodes.slice(i, i + ADJ_BATCH_SIZE));
                }

                // Compute adjustment per batch in parallel: (all_time_revenue - period_revenue)
                // for commessas that have invoices in the period, per client
                await Promise.all(adjBatches.map(async (batch) => {
                    const adjParams: Record<string, any> = {
                        codditt: 'COOPZANARDI',
                        year,
                        startDate,
                        endDate,
                    };
                    const placeholders = batch.map((code, i) => {
                        adjParams[`sc${i}`] = code;
                        return `@sc${i}`;
                    }).join(', ');

                    // Single query: find commessas in period for these clients,
                    // then get (all_time - period) revenue difference per client
                    const adjResult = await queryMSSQL(`
                        WITH PeriodCommessas AS (
                            SELECT DISTINCT dw.dw_commeca
                            FROM dwarehe dw WITH (NOLOCK)
                            INNER JOIN anagra an WITH (NOLOCK)
                                ON dw.dw_conto = an.an_conto
                                AND dw.codditt = an.codditt
                            WHERE dw.dw_scenario = 1
                              AND dw.codditt = @codditt
                              AND dw.dw_anno >= @year
                              AND dw.dw_datmov >= @startDate
                              AND dw.dw_datmov <= @endDate
                              AND an.an_tipo = 'C'
                              AND dw.dw_valfatt > 0
                              AND dw.dw_commeca > 0
                              AND an.an_conto IN (${placeholders})
                        )
                        SELECT 
                            an.an_conto as client_code,
                            SUM(dw.dw_valfatt) - SUM(CASE 
                                WHEN dw.dw_datmov >= @startDate AND dw.dw_datmov <= @endDate AND dw.dw_anno >= @year
                                THEN dw.dw_valfatt ELSE 0 
                            END) as revenue_adjustment
                        FROM dwarehe dw WITH (NOLOCK)
                        INNER JOIN anagra an WITH (NOLOCK)
                            ON dw.dw_conto = an.an_conto
                            AND dw.codditt = an.codditt
                        INNER JOIN PeriodCommessas pc ON dw.dw_commeca = pc.dw_commeca
                        WHERE dw.dw_scenario = 1
                          AND dw.codditt = @codditt
                          AND an.an_tipo = 'C'
                          AND dw.dw_valfatt > 0
                          AND an.an_conto IN (${placeholders})
                        GROUP BY an.an_conto
                        HAVING SUM(dw.dw_valfatt) - SUM(CASE 
                            WHEN dw.dw_datmov >= @startDate AND dw.dw_datmov <= @endDate AND dw.dw_anno >= @year
                            THEN dw.dw_valfatt ELSE 0 
                        END) > 0
                    `, adjParams, 'BUSINESS', queryTimeout);

                    adjResult.recordset.forEach(row => {
                        adjustments[row.client_code] = (adjustments[row.client_code] || 0) + row.revenue_adjustment;
                    });
                }));

                // Apply adjustments to records
                allRecords.forEach(record => {
                    if (record.split_orders_count > 0 && adjustments[record.client_code]) {
                        record.total_revenue += adjustments[record.client_code];
                    }
                });
            }
        }

        // Get work time from NETPRO for all commessas linked to these clients
        const clientCodes = allRecords.map(row => row.client_code);
        const { APP_CONFIG } = await import('@/config/constants');
        const hourlyRate = APP_CONFIG.ANALYTICS.HOURLY_LABOR_RATE;

        // Batch work costs in chunks of 50 clients to avoid massive IN clauses
        const BATCH_SIZE = 50;
        let workCosts: Record<string, number> = {};

        if (clientCodes.length <= BATCH_SIZE) {
            workCosts = await fetchWorkCostsForClients(clientCodes, year, startDate, endDate, hourlyRate);
        } else {
            const batches: string[][] = [];
            for (let i = 0; i < clientCodes.length; i += BATCH_SIZE) {
                batches.push(clientCodes.slice(i, i + BATCH_SIZE));
            }
            const batchResults = await Promise.all(
                batches.map(batch => fetchWorkCostsForClients(batch, year, startDate, endDate, hourlyRate))
            );
            batchResults.forEach(batchResult => {
                Object.assign(workCosts, batchResult);
            });
        }

        // Merge work costs into result
        const enrichedData = allRecords.map(row => ({
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




