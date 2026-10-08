/**
 * Ricavo Ordini from Business: delivered value, material and labour costs and margin per order.
 * How the revenue, costs and speed work: shared/business-report.ts.
 */

'use server'

import { BUSINESS_COMPANY } from '@/config/constants';
import { queryMSSQL, type SqlParams } from '@/lib/mssql';
import { DELIVERY_NOTE, HOURLY_RATE, ORDER_CORE, TIMEOUT } from './shared/business-report';
import { buildCommessaFilterBUSINESS, buildClientFilterForOrderRevenue } from './shared/filter-builders';
import {
    buildCommessaDescriptionFilter,
    businessOrderCodesSql,
    dropTempTablesSql,
    failedPage,
    setupDateParams,
    sortAndPage,
    type RowSortColumns,
    type SortConfig
} from './shared/query-utils';
import { fetchWorkTimesForCommessas } from './shared/work-time-fetcher';

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

/** What the SQL returns; work time, labour cost, full cost and margin are added afterwards */
type OrderRevenueSqlRow = Omit<OrderRevenueRow, 'work_time' | 'work_cost' | 'full_cost' | 'margin'>;

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

        const params: SqlParams = {
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

        const result = await queryMSSQL<OrderRevenueSqlRow>(`
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
            ? await fetchWorkTimesForCommessas(orders.map((row) => row.commessa_display))
            : {};

        const rows: OrderRevenueRow[] = orders.map((row) => {
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
        return failedPage<OrderRevenueRow>(err, page, limit);
    }
}
