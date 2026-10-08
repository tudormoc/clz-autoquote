/**
 * Sommario Clienti from Business: delivered value, material and labour costs and margin per client, and its total card.
 * How the revenue, costs and speed work: shared/business-report.ts.
 */

'use server'

import { BUSINESS_COMPANY } from '@/config/constants';
import { queryMSSQL, type SqlParams } from '@/lib/mssql';
import { DELIVERY_NOTE, ORDER_CORE, TIMEOUT } from './shared/business-report';
import { readLabourRates } from './shared/labour-rates';
import { buildClientFilter } from './shared/filter-builders';
import {
    businessOrderCodesSql,
    dropTempTablesSql,
    failedPage,
    queryErrorMessage,
    setupDateParams,
    sortAndPage,
    type RowSortColumns,
    type SortConfig
} from './shared/query-utils';
import { fetchWorkCostsForClients } from './shared/work-time-fetcher';

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

type ClientSummarySqlRow = Omit<ClientSummaryRow, 'work_cost' | 'full_cost' | 'margin'>;

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

    const params: SqlParams = {
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

        const [result, rates] = await Promise.all([
            queryMSSQL<ClientSummarySqlRow>(
                `${revenueSql} ${detailSql} SELECT * FROM #Rows; ${dropTempTablesSql(CLIENT_SUMMARY_TABLES)}`,
                params,
                'BUSINESS',
                TIMEOUT
            ),
            readLabourRates(),
        ]);
        const clients = result.recordset;

        const workCosts = await fetchWorkCostsForClients(
            clients.map((row) => row.client_code),
            year,
            startDate,
            endDate,
            rates.hourly
        );

        const rows: ClientSummaryRow[] = clients.map((row) => {
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
        return failedPage<ClientSummaryRow>(err, page, limit);
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

        const result = await queryMSSQL<{ total_value: number }>(
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
