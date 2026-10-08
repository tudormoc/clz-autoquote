/**
 * Production reports from NetPro (Report Produzione, Sommario Ordini): operator work time grouped and paged in SQL.
 * Tables and shared parts: shared/netpro-work.ts.
 */

'use server'

import { APP_CONFIG } from '@/config/constants';
import { queryMSSQL } from '@/lib/mssql';
import {
    buildCommessaFilterNETPRO,
    buildMachineFilter,
    buildOperatorFilter
} from './shared/filter-builders';
import { MACHINE_JOIN, MIN_ORDER_CORE, OPERATOR_JOIN, ORDER_CORE, WORK_ROWS, workFilter } from './shared/netpro-work';
import {
    buildPaginationResult,
    buildSqlOrderBy,
    calculateOffset,
    failedPage,
    type SortConfig
} from './shared/query-utils';

const ANALYTICS = APP_CONFIG.ANALYTICS;

/** A report grouped in SQL: the number of groups, then the requested page of them */
async function groupedPage<T>(
    query: { select: string; from: string; where: string; groupBy: string; orderBy: string },
    params: Record<string, unknown>,
    page: number,
    limit: number
) {
    const having = `HAVING SUM(SIT.LAVORO) > ${ANALYTICS.MIN_ROW_WORK_HOURS}`;
    const countResult = await queryMSSQL<{ total: number }>(`
        SELECT COUNT(*) as total
        FROM (SELECT 1 as dummy ${query.from} WHERE ${query.where} GROUP BY ${query.groupBy} ${having}) AS grouped_data
    `, params, 'NETPRO');

    const result = await queryMSSQL<T>(`
        SELECT ${query.select}
        ${query.from}
        WHERE ${query.where}
        GROUP BY ${query.groupBy}
        ${having}
        ORDER BY ${query.orderBy}
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `, { ...params, offset: calculateOffset(page, limit), limit }, 'NETPRO');

    return { success: true, data: result.recordset, pagination: buildPaginationResult(page, limit, countResult.recordset[0].total) };
}

/**
 * ============================================================================
 * PRODUCTION REPORT: operator work time per date, machine, operator and order
 * ============================================================================
 */
export interface ProductionRow {
    date: Date;
    machine: string | null;
    machine_name: string | null;
    operator: string;
    operator_name: string | null;
    work_time: number;
    qty_completed: number | null;
    qty_requested: number | null;
    commessa_full: string;
    commessa_display: string;
    order_description: string | null;
}

const PRODUCTION_SORT: Record<string, string> = {
    date: 'SIT.DATA',
    commessa: MIN_ORDER_CORE,
    machine: 'SIT.MACCHINA',
    operator: 'SIT.OGGETTO',
    time: 'SUM(SIT.LAVORO)',
    qty: 'SUM(SIT.QTA_COMPLETATA)',
    qty_requested: 'MAX(JST.QTA_RICHIESTA)',
};

export async function getProductionDataAction(
    year: number = 2024,
    page: number = 1,
    limit: number = 100,
    filters?: {
        commessa?: string;
        machine?: string;
        operator?: string;
        dateFrom?: string;
        dateTo?: string;
    },
    sort?: SortConfig
) {
    try {
        const { conditions, params } = workFilter(year, 'OPE', filters);
        conditions.push('ORD.COMMESSA IS NOT NULL');
        buildCommessaFilterNETPRO(filters?.commessa, conditions, params);
        buildMachineFilter(filters?.machine, conditions, params);
        buildOperatorFilter(filters?.operator, conditions, params);

        const groupBy = `SIT.DATA, SIT.MACCHINA, SIT.OGGETTO, ${ORDER_CORE}`;
        return await groupedPage<ProductionRow>({
            select: `
                SIT.DATA as date,
                SIT.MACCHINA as machine,
                MAX(MAC.DESCRIZIONE) as machine_name,
                SIT.OGGETTO as operator,
                MAX(OPE.NOME) as operator_name,
                SUM(SIT.LAVORO) as work_time,
                SUM(SIT.QTA_COMPLETATA) as qty_completed,
                MAX(JST.QTA_RICHIESTA) as qty_requested,
                MIN(ORD.COMMESSA) as commessa_full,
                ${MIN_ORDER_CORE} as commessa_display,
                MIN(ORD.DESCRIZIONE) as order_description`,
            from: `${WORK_ROWS} ${MACHINE_JOIN} ${OPERATOR_JOIN}`,
            where: conditions.join(' AND '),
            groupBy,
            orderBy: buildSqlOrderBy(PRODUCTION_SORT, sort, { column: 'date', direction: 'asc' }, groupBy),
        }, params, page, limit);
    } catch (err) {
        return failedPage(err, page, limit);
    }
}

/**
 * ============================================================================
 * ORDER SUMMARY REPORT (Sommario Ordini): operator work time per machine and order, all dates
 * ============================================================================
 */
export type OrderSummaryRow = Omit<ProductionRow, 'date' | 'operator' | 'operator_name'>;

const ORDER_SUMMARY_SORT: Record<string, string> = {
    commessa: MIN_ORDER_CORE,
    machine: 'SIT.MACCHINA',
    time: 'SUM(SIT.LAVORO)',
    qty: 'SUM(SIT.QTA_COMPLETATA)',
    qty_requested: 'MAX(JST.QTA_RICHIESTA)',
};

export async function getOrderSummaryDataAction(
    year: number = 2024,
    page: number = 1,
    limit: number = 100,
    filters?: {
        commessa?: string;
        machine?: string;
        dateFrom?: string;
        dateTo?: string;
    },
    sort?: SortConfig
) {
    try {
        const { conditions, params } = workFilter(year, 'OPE', filters);
        conditions.push('ORD.COMMESSA IS NOT NULL');
        buildCommessaFilterNETPRO(filters?.commessa, conditions, params);
        buildMachineFilter(filters?.machine, conditions, params);

        const groupBy = `SIT.MACCHINA, ${ORDER_CORE}`;
        return await groupedPage<OrderSummaryRow>({
            select: `
                SIT.MACCHINA as machine,
                MAX(MAC.DESCRIZIONE) as machine_name,
                SUM(SIT.LAVORO) as work_time,
                SUM(SIT.QTA_COMPLETATA) as qty_completed,
                MAX(JST.QTA_RICHIESTA) as qty_requested,
                MIN(ORD.COMMESSA) as commessa_full,
                ${MIN_ORDER_CORE} as commessa_display,
                MIN(ORD.DESCRIZIONE) as order_description`,
            from: `${WORK_ROWS} ${MACHINE_JOIN}`,
            where: conditions.join(' AND '),
            groupBy,
            orderBy: buildSqlOrderBy(ORDER_SUMMARY_SORT, sort, { column: 'commessa', direction: 'asc' }, groupBy),
        }, params, page, limit);
    } catch (err) {
        return failedPage(err, page, limit);
    }
}
