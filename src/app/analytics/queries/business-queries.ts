/**
 * BUSINESS Database Queries
 *
 * Revenue and cost reports from BUSINESS, with work times from NETPRO (work-time-fetcher).
 *
 * - Revenue: client rows (an_tipo = 'C') of the selected period.
 * - Material costs: supplier rows of the whole order history (not date-filtered), so an order invoiced this year
 *   keeps the costs it had last year. Labour cost = NETPRO work hours × hourly rate from config.
 * - Margin = revenue − (material + labour), computed here once for the table, Excel and PDF.
 * - Speed: dwarehe has ~15M rows. Each report first reads the period's orders, then their full dw_commeca codes
 *   (#OrderCodes), and joins dwarehe only on those codes through its index. The steps share #temp tables in one batch.
 * - Sorting and paging happen after labour is added (sortAndPage), so labour and margin sort like any other column.
 */

'use server'

import { APP_CONFIG, BUSINESS_COMPANY } from '@/config/constants';
import { queryMSSQL } from '@/lib/mssql';
import {
    buildCommessaFilterBUSINESS,
    buildClientFilter,
    buildClientFilterForOrderRevenue
} from './shared/filter-builders';
import {
    buildPaginationResult,
    sortAndPage,
    setupDateParams,
    buildCommessaDescriptionFilter,
    businessOrderCore,
    businessOrderCodesSql,
    dropTempTablesSql,
    queryErrorMessage,
    type RowSortColumns,
    type SortConfig
} from './shared/query-utils';
import {
    fetchWorkTimesForCommessas,
    fetchWorkCostsForClients
} from './shared/work-time-fetcher';

/** dw_tipork of delivery notes, whose dw_valore is the delivered value */
const DELIVERY_NOTE = 'B';
const TIMEOUT = APP_CONFIG.ANALYTICS.REPORT_QUERY_TIMEOUT_MS;
const HOURLY_RATE = APP_CONFIG.ANALYTICS.HOURLY_LABOR_RATE;
const ORDER_CORE = businessOrderCore('dw.dw_commeca');

/**
 * ============================================================================
 * ORDER REVENUE REPORT (Ricavo Ordini)
 * ============================================================================
 *
 * Delivered value, costs and margin per order (commessa).
 * "Intero" (includeAllRevenueForSplit): an order with client revenue also outside the period shows its whole
 * delivered value and is flagged (has_split_revenue).
 * ============================================================================
 */

/** One order of Ricavo Ordini */
export interface OrderRevenueRow {
    commessa_display: string;
    commessa_full: number;
    order_description: string | null;
    client_code: number;
    client_name: string;
    delivered_revenue: number;
    material_cost: number;
    total_quantity: number;
    has_split_revenue: number;
    work_time: number;
    work_cost: number;
    full_cost: number;
    margin: number;
}

const ORDER_REVENUE_TABLES = ['#ClientRevenue', '#OrderCodes', '#SupplierCosts', '#AllTimeRevenue'];

const ORDER_REVENUE_SORT: RowSortColumns<OrderRevenueRow> = {
    commessa: (row) => row.commessa_display,
    client: (row) => row.client_code,
    delivered_revenue: (row) => row.delivered_revenue,
    cost: (row) => row.material_cost,
    work_time: (row) => row.work_time,
    work_cost: (row) => row.work_cost,
    total_cost: (row) => row.full_cost,
    margin: (row) => row.margin,
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
            codditt: BUSINESS_COMPANY,
            year,
            startDate,
            endDate,
            tipoRec: DELIVERY_NOTE,
            includeAllRevenue: filters?.includeAllRevenueForSplit || false
        };

        buildCommessaFilterBUSINESS(filters?.commessa, conditions, params, true);
        buildClientFilterForOrderRevenue(filters?.client, conditions, params);
        const descriptionFilter = buildCommessaDescriptionFilter(filters?.commessa, params);

        const result = await queryMSSQL(`
            SET NOCOUNT ON;
            ${dropTempTablesSql(ORDER_REVENUE_TABLES)}

            -- Client revenue of the period, one row per order
            SELECT
                ${ORDER_CORE} AS commessa_display,
                MIN(dw.dw_commeca) AS commessa_full,
                MIN(an.an_conto) AS client_code,
                MAX(an.an_descr1) AS client_name,
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
            SELECT ${ORDER_CORE} AS commessa_display, SUM(dw.dw_acqvalore) AS material_cost
            INTO #SupplierCosts
            FROM #OrderCodes oc
            INNER JOIN dwarehe dw WITH (NOLOCK) ON dw.dw_commeca = oc.dw_commeca
            INNER JOIN anagra an WITH (NOLOCK) ON dw.dw_conto = an.an_conto AND dw.codditt = an.codditt
            WHERE dw.dw_scenario = 1
              AND dw.codditt = @codditt
              AND an.an_tipo = 'F'
              AND dw.dw_acqvalore <> 0
            GROUP BY ${ORDER_CORE};

            -- "Intero" only: whole delivered value of each order, and whether it is also invoiced or delivered outside the period
            SELECT
                ${ORDER_CORE} AS commessa_display,
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
                CASE WHEN atr.has_split_revenue = 1 THEN atr.delivered_revenue ELSE cr.delivered_revenue END AS delivered_revenue,
                ISNULL(sc.material_cost, 0) AS material_cost,
                cr.total_quantity,
                ISNULL(atr.has_split_revenue, 0) AS has_split_revenue
            FROM #ClientRevenue cr
            LEFT JOIN #SupplierCosts sc ON sc.commessa_display = cr.commessa_display
            LEFT JOIN #AllTimeRevenue atr ON atr.commessa_display = cr.commessa_display
            LEFT JOIN commess co WITH (NOLOCK) ON co.co_comme = cr.commessa_full AND co.codditt = @codditt
            ${descriptionFilter};

            ${dropTempTablesSql(ORDER_REVENUE_TABLES)}
        `, params, 'BUSINESS', TIMEOUT);

        const orders = result.recordset;
        const workTimes = orders.length > 0
            ? await fetchWorkTimesForCommessas(orders.map((row: any) => row.commessa_display))
            : {};

        const rows: OrderRevenueRow[] = orders.map((row: any) => {
            const work_time = workTimes[row.commessa_display] || 0;
            const work_cost = work_time * HOURLY_RATE;
            const full_cost = row.material_cost + work_cost;
            return { ...row, work_time, work_cost, full_cost, margin: row.delivered_revenue - full_cost };
        });

        return {
            success: true,
            ...sortAndPage(rows, sort, ORDER_REVENUE_SORT, { column: 'delivered_revenue', direction: 'desc' }, (row) => row.commessa_display, page, limit)
        };
    } catch (err) {
        console.error('OrderRevenueDataAction error:', err);
        return {
            success: false,
            error: queryErrorMessage(err),
            data: [] as OrderRevenueRow[],
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

/** One client of Sommario Clienti */
export interface ClientSummaryRow {
    client_code: number;
    client_name: string;
    total_orders: number;
    total_revenue: number;
    material_cost: number;
    total_quantity: number;
    split_orders_count: number;
    work_cost: number;
    full_cost: number;
    margin: number;
}

const CLIENT_SUMMARY_TABLES = ['#ClientRevenue', '#ClientOrders', '#OrderCodes', '#OrderCosts', '#OutsidePeriod', '#Rows'];

const CLIENT_SUMMARY_SORT: RowSortColumns<ClientSummaryRow> = {
    client: (row) => row.client_code,
    revenue: (row) => row.total_revenue,
    cost: (row) => row.material_cost,
    work_cost: (row) => row.work_cost,
    total_cost: (row) => row.full_cost,
    margin: (row) => row.margin,
};

/**
 * Batch shared by the table and its total card, in two parts the caller joins and then ends with its SELECT and cleanup:
 * - revenueSql: delivered value of the period per client in #ClientRevenue (all the card needs without "Intero")
 * - detailSql: one row per client in #Rows
 *   (client_code, client_name, total_orders, total_revenue, material_cost, total_quantity, split_orders_count)
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
        codditt: BUSINESS_COMPANY,
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
            ISNULL(cost.material_cost, 0) AS material_cost,
            cr.total_quantity,
            ISNULL(op.split_orders_count, 0) AS split_orders_count
        INTO #Rows
        FROM #ClientRevenue cr
        LEFT JOIN (
            SELECT o.client_code, SUM(c.commessa_cost) AS material_cost
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

        const result = await queryMSSQL(
            `${revenueSql} ${detailSql} SELECT * FROM #Rows; ${dropTempTablesSql(CLIENT_SUMMARY_TABLES)}`,
            params,
            'BUSINESS',
            TIMEOUT
        );
        const clients = result.recordset;

        const workCosts = await fetchWorkCostsForClients(
            clients.map((row: any) => row.client_code),
            year,
            startDate,
            endDate,
            HOURLY_RATE
        );

        const rows: ClientSummaryRow[] = clients.map((row: any) => {
            const work_cost = workCosts[row.client_code] || 0;
            const full_cost = row.material_cost + work_cost;
            return { ...row, work_cost, full_cost, margin: row.total_revenue - full_cost };
        });

        return {
            success: true,
            ...sortAndPage(rows, sort, CLIENT_SUMMARY_SORT, { column: 'revenue', direction: 'desc' }, (row) => String(row.client_code), page, limit)
        };
    } catch (err) {
        console.error('ClientSummaryDataAction error:', err);
        return {
            success: false,
            error: queryErrorMessage(err),
            data: [] as ClientSummaryRow[],
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
    } catch (err) {
        console.error('ClientSummaryStatsAction error:', err);
        return {
            success: false,
            error: queryErrorMessage(err),
            data: { total_value: 0 }
        };
    }
}
