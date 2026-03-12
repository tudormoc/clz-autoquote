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
 * ORDER REVENUE REPORT
 * ============================================================================
 * 
 * Shows revenue, costs, and margin per order (commessa).
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

        buildCommessaFilterBUSINESS(filters?.commessa, conditions, params, true);
        buildClientFilterForOrderRevenue(filters?.client, conditions, params);

        const whereClause = conditions.join(' AND ');
        const rawOrderByClause = buildOrderRevenueOrderBy(sort?.column || 'revenue', sort?.direction || 'desc');
        const postCTEFilter = buildPostCTECommessaFilter(filters?.commessa, params);
        const orderByClause = transformOrderByForCTE(rawOrderByClause);
        const queryTimeout = exportAll ? 30000 : undefined;

        const mainQuery = `
            WITH ClientRevenue AS (
                SELECT 
                    RIGHT(CAST(dw.dw_commeca / 100 AS VARCHAR), 4) as commessa_display,
                    MIN(dw.dw_commeca) as commessa_full,
                    MIN(an.an_conto) as client_code,
                    MAX(an.an_descr1) as client_name,
                    ISNULL(SUM(dw.dw_valfatt), 0) as total_revenue,
                    ISNULL(SUM(dw.dw_valore), 0) as delivered_revenue,
                    ISNULL(SUM(dw.dw_collifatt), 0) as total_quantity
                FROM dwarehe dw WITH (NOLOCK)
                INNER JOIN anagra an WITH (NOLOCK) 
                    ON dw.dw_conto = an.an_conto 
                    AND dw.codditt = an.codditt
                WHERE ${whereClause}
                  AND an.an_tipo = 'C'
                  AND (dw.dw_valfatt > 0 OR dw.dw_valore > 0)
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
                  AND (dw.dw_valfatt > 0 OR dw.dw_valore > 0)
                  AND dw.dw_commeca > 0
                  AND (dw.dw_datmov < @startDate OR dw.dw_datmov > @endDate)
            )
            SELECT 
                RIGHT(CAST(cr.commessa_full / 100 AS VARCHAR), 4) as commessa_display,
                cr.commessa_full,
                co.co_descr1 as order_description,
                cr.client_code,
                cr.client_name,
                ISNULL(cr.total_revenue, 0) as total_revenue,
                ISNULL(cr.delivered_revenue, 0) as delivered_revenue,
                ISNULL(sc.total_cost, 0) as total_cost,
                ISNULL(cr.total_quantity, 0) as total_quantity,
                CASE WHEN sr.commessa_display IS NOT NULL THEN 1 ELSE 0 END as has_split_revenue
            FROM ClientRevenue cr
            LEFT JOIN SupplierCosts sc ON cr.commessa_display = sc.commessa_display
            LEFT JOIN SplitRevenue sr ON cr.commessa_display = sr.commessa_display
            LEFT JOIN commess co WITH (NOLOCK)
                ON cr.commessa_full = co.co_comme
                AND co.codditt = @codditt
            ${postCTEFilter}
            ORDER BY ${orderByClause}
            OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
        `;

        const countQuery = `
            SELECT COUNT(DISTINCT RIGHT(CAST(dw.dw_commeca / 100 AS VARCHAR), 4)) as total
            FROM dwarehe dw WITH (NOLOCK)
            INNER JOIN anagra an WITH (NOLOCK) 
                ON dw.dw_conto = an.an_conto 
                AND dw.codditt = an.codditt
            WHERE ${whereClause}
              AND an.an_tipo = 'C'
              AND (dw.dw_valfatt > 0 OR dw.dw_valore > 0)
        `;

        let allRecords: any[];
        let total: number;

        if (exportAll) {
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
            const countPromise = queryMSSQL(countQuery, params, 'BUSINESS');
            const dataPromise = queryMSSQL(mainQuery, params, 'BUSINESS', queryTimeout);
            const [countResult, result] = await Promise.all([countPromise, dataPromise]);
            total = countResult.recordset[0].total;
            allRecords = result.recordset;
        }

        if (includeAllRevenue && allRecords.length > 0) {
            const splitCommessas = allRecords.filter(r => r.has_split_revenue === 1).map(r => r.commessa_display) as string[];

            if (splitCommessas.length > 0) {
                const ADJ_BATCH_SIZE = 50;
                const adjustments: Record<string, { rev: number, del: number }> = {};
                const adjBatches: string[][] = [];
                for (let i = 0; i < splitCommessas.length; i += ADJ_BATCH_SIZE) {
                    adjBatches.push(splitCommessas.slice(i, i + ADJ_BATCH_SIZE));
                }

                await Promise.all(adjBatches.map(async (batch) => {
                    const adjParams: Record<string, any> = { codditt: 'COOPZANARDI' };
                    const placeholders = batch.map((code, i) => {
                        adjParams[`cm${i}`] = code;
                        return `@cm${i}`;
                    }).join(', ');

                    const adjResult = await queryMSSQL(`
                        SELECT 
                            RIGHT(CAST(dw.dw_commeca / 100 AS VARCHAR), 4) as commessa_display,
                            ISNULL(SUM(dw.dw_valfatt), 0) as all_time_revenue,
                            ISNULL(SUM(dw.dw_valore), 0) as all_time_delivered
                        FROM dwarehe dw WITH (NOLOCK)
                        INNER JOIN anagra an WITH (NOLOCK)
                            ON dw.dw_conto = an.an_conto
                            AND dw.codditt = an.codditt
                        WHERE dw.dw_scenario = 1
                          AND dw.codditt = @codditt
                          AND an.an_tipo = 'C'
                          AND (dw.dw_valfatt > 0 OR dw.dw_valore > 0)
                          AND RIGHT(CAST(dw.dw_commeca / 100 AS VARCHAR), 4) IN (${placeholders})
                        GROUP BY RIGHT(CAST(dw.dw_commeca / 100 AS VARCHAR), 4)
                    `, adjParams, 'BUSINESS', queryTimeout);

                    adjResult.recordset.forEach(row => {
                        adjustments[row.commessa_display] = {
                            rev: row.all_time_revenue,
                            del: row.all_time_delivered
                        };
                    });
                }));

                allRecords.forEach(record => {
                    if (record.has_split_revenue === 1 && adjustments[record.commessa_display]) {
                        record.total_revenue = adjustments[record.commessa_display].rev;
                        record.delivered_revenue = adjustments[record.commessa_display].del;
                    }
                });
            }
        }

        const allCommessaCodes = allRecords.map(row => row.commessa_display);
        let workTimes = await fetchWorkTimesForCommessas(allCommessaCodes);

        const { APP_CONFIG } = await import('@/config/constants');
        const hourlyRate = APP_CONFIG.ANALYTICS.HOURLY_LABOR_RATE;

        const enrichedData = allRecords.map(row => ({
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
        return { success: false, error: err.message, data: [], pagination: buildPaginationResult(page, limit, 0) };
    }
}

/**
 * ============================================================================
 * CLIENT SUMMARY REPORT
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

        buildClientFilter(filters?.client, conditions, params);
        const whereClause = conditions.join(' AND ');
        const orderByClause = buildClientSummaryOrderBy(sort?.column || 'revenue', sort?.direction || 'desc');
        const queryTimeout = exportAll ? 30000 : undefined;

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
                  AND dw.dw_valfatt <> 0
                GROUP BY an.an_conto, an.an_descr1
            ),
            SupplierCosts AS (
                SELECT 
                    dw.dw_commeca,
                    SUM(dw.dw_acqvalore) as commessa_cost
                FROM dwarehe dw WITH (NOLOCK)
                WHERE dw.dw_scenario = 1
                  AND dw.codditt = @codditt
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
                  AND dw.dw_valfatt <> 0
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
                  AND dw.dw_valfatt <> 0
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

        const countQuery = `
            SELECT COUNT(DISTINCT an.an_conto) as total
            FROM dwarehe dw WITH (NOLOCK)
            INNER JOIN anagra an WITH (NOLOCK) 
                ON dw.dw_conto = an.an_conto 
                AND dw.codditt = an.codditt
            WHERE ${whereClause}
              AND an.an_tipo = 'C'
              AND dw.dw_valfatt <> 0
        `;

        const [countResult, result] = await Promise.all([
            queryMSSQL(countQuery, params, 'BUSINESS'),
            queryMSSQL(mainQuery, params, 'BUSINESS', queryTimeout)
        ]);

        let allRecords = result.recordset;
        const total = countResult.recordset[0].total;

        if (includeAllRevenue && allRecords.length > 0) {
            const splitClientCodes = Array.from(new Set(allRecords.filter(r => r.split_orders_count > 0).map(r => r.client_code))) as string[];
            if (splitClientCodes.length > 0) {
                const adjustments: Record<string, number> = {};
                await Promise.all(splitClientCodes.map(async (code) => {
                    const adjParams = { codditt: 'COOPZANARDI', year, startDate, endDate, client: code };
                    const adjResult = await queryMSSQL(`
                        WITH PeriodCommessas AS (
                            SELECT DISTINCT dw.dw_commeca
                            FROM dwarehe dw WITH (NOLOCK)
                            WHERE dw.dw_scenario = 1 AND dw.codditt = @codditt AND dw.dw_anno >= @year
                              AND dw.dw_datmov >= @startDate AND dw.dw_datmov <= @endDate
                              AND dw.dw_conto = @client AND dw.dw_valfatt <> 0
                        )
                        SELECT SUM(dw.dw_valfatt) - SUM(CASE WHEN dw.dw_datmov >= @startDate AND dw.dw_datmov <= @endDate AND dw.dw_anno >= @year THEN dw.dw_valfatt ELSE 0 END) as adjustment
                        FROM dwarehe dw WITH (NOLOCK)
                        INNER JOIN PeriodCommessas pc ON dw.dw_commeca = pc.dw_commeca
                        WHERE dw.dw_scenario = 1 AND dw.codditt = @codditt AND dw.dw_valfatt <> 0
                    `, adjParams, 'BUSINESS');
                    adjustments[code] = adjResult.recordset[0]?.adjustment || 0;
                }));
                allRecords.forEach(r => { if (adjustments[r.client_code]) r.total_revenue += adjustments[r.client_code]; });
            }
        }

        const clientCodes = allRecords.map(row => row.client_code);
        const { APP_CONFIG } = await import('@/config/constants');
        const workCosts = await fetchWorkCostsForClients(clientCodes, year, startDate, endDate, APP_CONFIG.ANALYTICS.HOURLY_LABOR_RATE);

        const enrichedData = allRecords.map(row => ({
            ...row,
            work_cost: workCosts[row.client_code] || 0
        }));

        return { success: true, data: enrichedData, pagination: buildPaginationResult(page, limit, total) };
    } catch (err: any) {
        return { success: false, error: err.message, data: [], pagination: buildPaginationResult(page, limit, 0) };
    }
}

/**
 * ============================================================================
 * CLIENT SUMMARY STATISTICS
 * ============================================================================
 */
export async function getClientSummaryStatsAction(
    year: number = 2024,
    filters?: {
        client?: string;
        dateFrom?: string;
        dateTo?: string;
        includeAllRevenueForSplit?: boolean;
    }
) {
    try {
        const { startDate, endDate } = setupDateParams(year, filters?.dateFrom, filters?.dateTo);
        const includeAllRevenue = filters?.includeAllRevenueForSplit || false;

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
            endDate
        };

        buildClientFilter(filters?.client, conditions, params);
        const whereClause = conditions.join(' AND ');

        const result = await queryMSSQL(`
            SELECT ISNULL(SUM(dw.dw_valfatt), 0) as total_revenue
            FROM dwarehe dw WITH (NOLOCK)
            INNER JOIN anagra an WITH (NOLOCK) 
                ON dw.dw_conto = an.an_conto 
                AND dw.codditt = an.codditt
            WHERE ${whereClause}
              AND an.an_tipo = 'C'
              AND dw.dw_valfatt <> 0
        `, params, 'BUSINESS');

        let totalRevenue = result.recordset[0]?.total_revenue || 0;

        if (includeAllRevenue && totalRevenue > 0) {
            const adjResult = await queryMSSQL(`
                WITH PeriodCommessas AS (
                    SELECT DISTINCT dw.dw_commeca
                    FROM dwarehe dw WITH (NOLOCK)
                    INNER JOIN anagra an WITH (NOLOCK)
                        ON dw.dw_conto = an.an_conto
                        AND dw.codditt = an.codditt
                    WHERE ${whereClause}
                      AND an.an_tipo = 'C'
                      AND dw.dw_valfatt <> 0
                )
                SELECT 
                    ISNULL(SUM(dw.dw_valfatt), 0) - ISNULL(SUM(CASE 
                        WHEN dw.dw_datmov >= @startDate AND dw.dw_datmov <= @endDate AND dw.dw_anno >= @year
                        THEN dw.dw_valfatt ELSE 0 
                    END), 0) as revenue_adjustment
                FROM dwarehe dw WITH (NOLOCK)
                INNER JOIN anagra an WITH (NOLOCK)
                    ON dw.dw_conto = an.an_conto
                    AND dw.codditt = an.codditt
                INNER JOIN PeriodCommessas pc ON dw.dw_commeca = pc.dw_commeca
                WHERE dw.dw_scenario = 1
                  AND dw.codditt = @codditt
                  AND an.an_tipo = 'C'
                  AND dw.dw_valfatt <> 0
            `, params, 'BUSINESS');
            
            totalRevenue += (adjResult.recordset[0]?.revenue_adjustment || 0);
        }

        return {
            success: true,
            data: {
                total_value: totalRevenue
            }
        };

    } catch (err: any) {
        return {
            success: false,
            error: err.message,
            data: {
                total_value: 0
            }
        };
    }
}
