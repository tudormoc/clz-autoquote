/**
 * BUSINESS Database Queries
 *
 * Revenue and cost reports from BUSINESS, with work times from NETPRO (work-time-fetcher).
 *
 * - Revenue: client rows (an_tipo = 'C') of the selected period.
 * - Material costs: supplier rows of the whole order history (not date-filtered), so an order invoiced this year
 *   keeps the costs it had last year. Labour cost = NETPRO work hours × hourly rate from config.
 * - Speed: dwarehe has ~15M rows. Each report first reads the period's orders, then their full dw_commeca codes
 *   (#OrderCodes), and joins dwarehe only on those codes through its index. The steps share #temp tables in one batch.
 */

'use server'

import { APP_CONFIG } from '@/config/constants';
import { queryMSSQL } from '@/lib/mssql';
import {
    buildCommessaFilterBUSINESS,
    buildClientFilter,
    buildClientFilterForOrderRevenue
} from './shared/filter-builders';
import {
    calculateOffset,
    buildPaginationResult,
    buildOrderBy,
    setupDateParams,
    buildCommessaDescriptionFilter,
    businessOrderCore,
    businessOrderCodesSql,
    dropTempTablesSql,
    pageOfRowsSql,
    queryErrorMessage,
    type SortConfig
} from './shared/query-utils';
import {
    fetchWorkTimesForCommessas,
    fetchWorkCostsForClients
} from './shared/work-time-fetcher';

const CODDITT = 'COOPZANARDI';
/** dw_tipork of delivery notes, whose dw_valore is the delivered value */
const DELIVERY_NOTE = 'B';
const TIMEOUT = APP_CONFIG.ANALYTICS.REPORT_QUERY_TIMEOUT_MS;
const ORDER_CORE = businessOrderCore('dw.dw_commeca');

/**
 * ============================================================================
 * ORDER REVENUE REPORT (Ricavo Ordini)
 * ============================================================================
 *
 * Revenue, costs and margin per order (commessa).
 * "Intero" (includeAllRevenueForSplit): an order with client revenue also outside the period shows its whole revenue
 * and is flagged (has_split_revenue).
 * ============================================================================
 */

const ORDER_REVENUE_TABLES = ['#ClientRevenue', '#OrderCodes', '#SupplierCosts', '#AllTimeRevenue', '#Rows'];

/** UI sort key → column of #Rows. Work hours and labour cost come from NETPRO after paging, so they cannot sort. */
const ORDER_REVENUE_SORT: Record<string, string> = {
    commessa: 'commessa_display',
    client: 'client_code',
    delivered_revenue: 'delivered_revenue',
    cost: 'total_cost',
    margin: '(delivered_revenue - total_cost)',
};

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
    sort?: SortConfig
) {
    try {
        const { startDate, endDate } = setupDateParams(year, filters?.dateFrom, filters?.dateTo);

        const conditions: string[] = [
            'dw.dw_scenario = 1',
            'dw.codditt = @codditt',
            'dw.dw_anno >= @year',
            'dw.dw_datmov >= @startDate',
            'dw.dw_datmov <= @endDate',
            'dw.dw_commeca > 0',
            'dw.dw_tipork = @tipoRec'
        ];

        const params: Record<string, any> = {
            codditt: CODDITT,
            year,
            startDate,
            endDate,
            offset: calculateOffset(page, limit),
            limit,
            tipoRec: DELIVERY_NOTE,
            includeAllRevenue: filters?.includeAllRevenueForSplit || false
        };

        buildCommessaFilterBUSINESS(filters?.commessa, conditions, params, true);
        buildClientFilterForOrderRevenue(filters?.client, conditions, params);
        const descriptionFilter = buildCommessaDescriptionFilter(filters?.commessa, params);
        const orderBy = buildOrderBy(ORDER_REVENUE_SORT, sort, 'delivered_revenue', 'commessa_display');

        const result = await queryMSSQL(`
            SET NOCOUNT ON;
            ${dropTempTablesSql(ORDER_REVENUE_TABLES)}

            -- Client revenue of the period, one row per order
            SELECT
                ${ORDER_CORE} AS commessa_display,
                MIN(dw.dw_commeca) AS commessa_full,
                MIN(an.an_conto) AS client_code,
                MAX(an.an_descr1) AS client_name,
                ISNULL(SUM(dw.dw_valfatt), 0) AS total_revenue,
                ISNULL(SUM(dw.dw_valore), 0) AS delivered_revenue,
                ISNULL(SUM(dw.dw_collifatt), 0) AS total_quantity
            INTO #ClientRevenue
            FROM dwarehe dw WITH (NOLOCK)
            INNER JOIN anagra an WITH (NOLOCK) ON dw.dw_conto = an.an_conto AND dw.codditt = an.codditt
            WHERE ${conditions.join(' AND ')}
              AND an.an_tipo = 'C'
              AND (dw.dw_valfatt > 0 OR dw.dw_valore > 0)
            GROUP BY ${ORDER_CORE};

            ${businessOrderCodesSql('#ClientRevenue', 'commessa_display')}

            -- Material costs of those orders, whole history
            SELECT ${ORDER_CORE} AS commessa_display, SUM(dw.dw_acqvalore) AS total_cost
            INTO #SupplierCosts
            FROM #OrderCodes oc
            INNER JOIN dwarehe dw WITH (NOLOCK) ON dw.dw_commeca = oc.dw_commeca
            INNER JOIN anagra an WITH (NOLOCK) ON dw.dw_conto = an.an_conto AND dw.codditt = an.codditt
            WHERE dw.dw_scenario = 1
              AND dw.codditt = @codditt
              AND an.an_tipo = 'F'
              AND dw.dw_acqvalore <> 0
            GROUP BY ${ORDER_CORE};

            -- "Intero" only: whole client revenue of each order, and whether part of it is outside the period
            SELECT
                ${ORDER_CORE} AS commessa_display,
                ISNULL(SUM(dw.dw_valfatt), 0) AS total_revenue,
                ISNULL(SUM(dw.dw_valore), 0) AS delivered_revenue,
                MAX(CASE WHEN dw.dw_datmov < @startDate OR dw.dw_datmov > @endDate THEN 1 ELSE 0 END) AS has_split_revenue
            INTO #AllTimeRevenue
            FROM #OrderCodes oc
            INNER JOIN dwarehe dw WITH (NOLOCK) ON dw.dw_commeca = oc.dw_commeca
            INNER JOIN anagra an WITH (NOLOCK) ON dw.dw_conto = an.an_conto AND dw.codditt = an.codditt
            WHERE @includeAllRevenue = 1
              AND dw.dw_scenario = 1
              AND dw.codditt = @codditt
              AND an.an_tipo = 'C'
              AND (dw.dw_valfatt > 0 OR dw.dw_valore > 0)
            GROUP BY ${ORDER_CORE};

            SELECT
                cr.commessa_display,
                cr.commessa_full,
                co.co_descr1 AS order_description,
                cr.client_code,
                cr.client_name,
                CASE WHEN atr.has_split_revenue = 1 THEN atr.total_revenue ELSE cr.total_revenue END AS total_revenue,
                CASE WHEN atr.has_split_revenue = 1 THEN atr.delivered_revenue ELSE cr.delivered_revenue END AS delivered_revenue,
                ISNULL(sc.total_cost, 0) AS total_cost,
                cr.total_quantity,
                ISNULL(atr.has_split_revenue, 0) AS has_split_revenue
            INTO #Rows
            FROM #ClientRevenue cr
            LEFT JOIN #SupplierCosts sc ON sc.commessa_display = cr.commessa_display
            LEFT JOIN #AllTimeRevenue atr ON atr.commessa_display = cr.commessa_display
            LEFT JOIN commess co WITH (NOLOCK) ON co.co_comme = cr.commessa_full AND co.codditt = @codditt
            ${descriptionFilter};

            ${pageOfRowsSql(orderBy, ORDER_REVENUE_TABLES)}
        `, params, 'BUSINESS', TIMEOUT);

        const [[{ total }], rows] = result.recordsets as any[];

        const workTimes = rows.length > 0
            ? await fetchWorkTimesForCommessas(rows.map((row: any) => row.commessa_display))
            : {};
        const hourlyRate = APP_CONFIG.ANALYTICS.HOURLY_LABOR_RATE;

        const enrichedData = rows.map((row: any) => ({
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
        console.error('OrderRevenueDataAction error:', err);
        return {
            success: false,
            error: queryErrorMessage(err),
            data: [],
            pagination: buildPaginationResult(page, limit, 0)
        };
    }
}

/**
 * ============================================================================
 * CLIENT SUMMARY REPORT (Sommario Clienti)
 * ============================================================================
 *
 * Delivered value (delivery notes), material and labour costs per client.
 * ⚠️ split_orders_count: orders of the period for which the same client also has value outside the period.
 * "Intero" (includeAllRevenueForSplit) adds that outside value to the client's revenue.
 * ============================================================================
 */

interface ClientSummaryFilters {
    client?: string;
    dateFrom?: string;
    dateTo?: string;
    includeAllRevenueForSplit?: boolean;
}

const CLIENT_SUMMARY_TABLES = ['#ClientRevenue', '#ClientOrders', '#OrderCodes', '#OrderCosts', '#OutsidePeriod', '#Rows'];

/** UI sort key → column of #Rows. Labour cost comes from NETPRO after paging, so it cannot sort. */
const CLIENT_SUMMARY_SORT: Record<string, string> = {
    client: 'client_code',
    revenue: 'total_revenue',
    cost: 'total_cost',
    margin: '(total_revenue - total_cost)',
};

/**
 * Batch shared by the table and its total card, in two parts the caller joins and then ends with its SELECT and cleanup:
 * - revenueSql: delivered value of the period per client in #ClientRevenue (all the card needs without "Intero")
 * - detailSql: one row per client in #Rows
 *   (client_code, client_name, total_orders, total_revenue, total_cost, total_quantity, split_orders_count)
 */
function buildClientSummaryBatch(year: number, filters?: ClientSummaryFilters) {
    const { startDate, endDate } = setupDateParams(year, filters?.dateFrom, filters?.dateTo);

    const conditions: string[] = [
        'dw.dw_scenario = 1',
        'dw.codditt = @codditt',
        'dw.dw_anno >= @year',
        'dw.dw_datmov >= @startDate',
        'dw.dw_datmov <= @endDate'
    ];

    const params: Record<string, any> = {
        codditt: CODDITT,
        year,
        startDate,
        endDate,
        tipoRec: DELIVERY_NOTE,
        includeAllRevenue: filters?.includeAllRevenueForSplit || false
    };

    buildClientFilter(filters?.client, conditions, params);
    const periodWhere = conditions.join(' AND ');
    const inPeriod = 'dw.dw_datmov >= @startDate AND dw.dw_datmov <= @endDate AND dw.dw_anno >= @year';

    const revenueSql = `
        SET NOCOUNT ON;
        ${dropTempTablesSql(CLIENT_SUMMARY_TABLES)}

        -- Delivered value of the period per client (delivery notes)
        SELECT
            an.an_conto AS client_code,
            an.an_descr1 AS client_name,
            COUNT(DISTINCT CASE WHEN dw.dw_commeca > 0 THEN ${ORDER_CORE} END) AS total_orders,
            SUM(dw.dw_valore) AS total_revenue,
            SUM(dw.dw_collifatt) AS total_quantity
        INTO #ClientRevenue
        FROM dwarehe dw WITH (NOLOCK)
        INNER JOIN anagra an WITH (NOLOCK) ON dw.dw_conto = an.an_conto AND dw.codditt = an.codditt
        WHERE ${periodWhere}
          AND dw.dw_tipork = @tipoRec
          AND an.an_tipo = 'C'
          AND dw.dw_valore <> 0
        GROUP BY an.an_conto, an.an_descr1;
    `;

    const detailSql = `
        -- Orders of each client with value in the period, any document type;
        -- on_delivery_note = 1 when a delivery note is among them (the order counts in the revenue above)
        SELECT
            an.an_conto AS client_code,
            ${ORDER_CORE} AS commessa_core,
            MAX(CASE WHEN dw.dw_tipork = @tipoRec THEN 1 ELSE 0 END) AS on_delivery_note
        INTO #ClientOrders
        FROM dwarehe dw WITH (NOLOCK)
        INNER JOIN anagra an WITH (NOLOCK) ON dw.dw_conto = an.an_conto AND dw.codditt = an.codditt
        WHERE ${periodWhere}
          AND an.an_tipo = 'C'
          AND dw.dw_valore <> 0
          AND dw.dw_commeca > 0
        GROUP BY an.an_conto, ${ORDER_CORE};

        ${businessOrderCodesSql('#ClientOrders', 'commessa_core')}

        -- Material costs of those orders, whole history
        SELECT ${ORDER_CORE} AS commessa_core, SUM(dw.dw_acqvalore) AS commessa_cost
        INTO #OrderCosts
        FROM #OrderCodes oc
        INNER JOIN dwarehe dw WITH (NOLOCK) ON dw.dw_commeca = oc.dw_commeca
        WHERE dw.dw_scenario = 1
          AND dw.codditt = @codditt
          AND dw.dw_acqvalore <> 0
        GROUP BY ${ORDER_CORE};

        -- Value of the same orders for the same client outside the period
        SELECT
            o.client_code,
            COUNT(DISTINCT CASE WHEN ${inPeriod} THEN NULL ELSE o.commessa_core END) AS split_orders_count,
            SUM(CASE WHEN ${inPeriod} THEN 0 ELSE dw.dw_valore END) AS outside_revenue
        INTO #OutsidePeriod
        FROM #OrderCodes oc
        INNER JOIN dwarehe dw WITH (NOLOCK) ON dw.dw_commeca = oc.dw_commeca
        INNER JOIN #ClientOrders o ON o.client_code = dw.dw_conto AND o.commessa_core = ${ORDER_CORE}
        WHERE dw.dw_scenario = 1
          AND dw.codditt = @codditt
          AND dw.dw_valore <> 0
        GROUP BY o.client_code;

        SELECT
            cr.client_code,
            cr.client_name,
            cr.total_orders,
            cr.total_revenue + CASE WHEN @includeAllRevenue = 1 THEN ISNULL(op.outside_revenue, 0) ELSE 0 END AS total_revenue,
            ISNULL(cost.total_cost, 0) AS total_cost,
            cr.total_quantity,
            ISNULL(op.split_orders_count, 0) AS split_orders_count
        INTO #Rows
        FROM #ClientRevenue cr
        LEFT JOIN (
            SELECT o.client_code, SUM(c.commessa_cost) AS total_cost
            FROM #ClientOrders o
            INNER JOIN #OrderCosts c ON c.commessa_core = o.commessa_core
            WHERE o.on_delivery_note = 1
            GROUP BY o.client_code
        ) cost ON cost.client_code = cr.client_code
        LEFT JOIN #OutsidePeriod op ON op.client_code = cr.client_code;
    `;

    return { revenueSql, detailSql, params, startDate, endDate };
}

export async function getClientSummaryDataAction(
    year: number = 2024,
    page: number = 1,
    limit: number = 100,
    filters?: ClientSummaryFilters,
    sort?: SortConfig
) {
    try {
        const { revenueSql, detailSql, params, startDate, endDate } = buildClientSummaryBatch(year, filters);
        const orderBy = buildOrderBy(CLIENT_SUMMARY_SORT, sort, 'revenue', 'client_code');

        const result = await queryMSSQL(
            revenueSql + detailSql + pageOfRowsSql(orderBy, CLIENT_SUMMARY_TABLES),
            { ...params, offset: calculateOffset(page, limit), limit },
            'BUSINESS',
            TIMEOUT
        );
        const [[{ total }], rows] = result.recordsets as any[];

        const workCosts = await fetchWorkCostsForClients(
            rows.map((row: any) => row.client_code),
            year,
            startDate,
            endDate,
            APP_CONFIG.ANALYTICS.HOURLY_LABOR_RATE
        );

        const enrichedData = rows.map((row: any) => ({
            ...row,
            work_cost: workCosts[row.client_code] || 0
        }));

        return { success: true, data: enrichedData, pagination: buildPaginationResult(page, limit, total) };
    } catch (err: any) {
        console.error('ClientSummaryDataAction error:', err);
        return {
            success: false,
            error: queryErrorMessage(err),
            data: [],
            pagination: buildPaginationResult(page, limit, 0)
        };
    }
}

/** Total revenue card of Sommario Clienti: the sum of the table's revenue column over all pages */
export async function getClientSummaryStatsAction(
    year: number = 2024,
    filters?: ClientSummaryFilters
) {
    try {
        const { revenueSql, detailSql, params } = buildClientSummaryBatch(year, filters);
        const totalSql = filters?.includeAllRevenueForSplit
            ? `${detailSql} SELECT ISNULL(SUM(total_revenue), 0) AS total_value FROM #Rows;`
            : 'SELECT ISNULL(SUM(total_revenue), 0) AS total_value FROM #ClientRevenue;';

        const result = await queryMSSQL(
            `${revenueSql} ${totalSql} ${dropTempTablesSql(CLIENT_SUMMARY_TABLES)}`,
            params,
            'BUSINESS',
            TIMEOUT
        );

        return { success: true, data: { total_value: result.recordset[0].total_value } };
    } catch (err: any) {
        console.error('ClientSummaryStatsAction error:', err);
        return {
            success: false,
            error: queryErrorMessage(err),
            data: { total_value: 0 }
        };
    }
}
