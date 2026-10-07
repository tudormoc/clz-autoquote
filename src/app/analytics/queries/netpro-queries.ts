/**
 * NETPRO Database Queries (production tracking)
 *
 * - SITUAZIONI: time tracking (TIPO 'WORK'; TIPO_OGGETTO 'OPE' operator time, 'MAC' machine time)
 * - JOBSET → ORDINI: the order of each task; MACCHINE, OPERATORI: names
 *
 * Production and Ordini group and page in SQL; the two area reports group machines into the areas of
 * APP_CONFIG.ANALYTICS.MACHINE_AREAS in code, then sort and page with sortAndPage.
 */

'use server'

import { errorMessage } from '@/lib/utils';
import { APP_CONFIG } from '@/config/constants';
import { queryMSSQL } from '@/lib/mssql';
import type { RowSortColumns } from '@/lib/sort';
import {
    buildCommessaFilterNETPRO,
    buildMachineFilter,
    buildOperatorFilter
} from './shared/filter-builders';
import { fetchOrderBusinessData } from './shared/work-time-fetcher';
import {
    buildPaginationResult,
    buildSqlOrderBy,
    calculateOffset,
    netproOrderCore,
    sortAndPage,
    type SortConfig
} from './shared/query-utils';

const ANALYTICS = APP_CONFIG.ANALYTICS;
const MACHINE_AREAS = ANALYTICS.MACHINE_AREAS as Record<string, readonly string[]>;
const ORDER_CORE = netproOrderCore('ORD.COMMESSA');
const MIN_ORDER_CORE = netproOrderCore('MIN(ORD.COMMESSA)');

const WORK_ROWS = `
    FROM SITUAZIONI SIT WITH (NOLOCK)
    LEFT JOIN JOBSET JST WITH (NOLOCK) ON SIT.TASK = JST.TASK
    LEFT JOIN ORDINI ORD WITH (NOLOCK) ON JST.ORDINE = ORD.ORDINE`;
const MACHINE_JOIN = 'LEFT JOIN MACCHINE MAC WITH (NOLOCK) ON SIT.MACCHINA = MAC.MACCHINA';
const OPERATOR_JOIN = 'LEFT JOIN OPERATORI OPE WITH (NOLOCK) ON SIT.OGGETTO = OPE.OPERATORE';

/** Work rows of the period (default: from 1 January of `year` for two years) for operator or machine time */
function workFilter(year: number, tipoOggetto: 'OPE' | 'MAC', dates?: { dateFrom?: string; dateTo?: string }) {
    const conditions = ['SIT.DATA >= @startDate', 'SIT.DATA <= @endDate', 'SIT.TIPO = @tipo', 'SIT.TIPO_OGGETTO = @tipoOggetto'];
    const params: Record<string, unknown> = {
        startDate: dates?.dateFrom || `${year}-01-01`,
        endDate: dates?.dateTo || `${year + 2}-01-01`,
        tipo: 'WORK',
        tipoOggetto,
    };
    return { conditions, params };
}

/** A report grouped in SQL: the number of groups, then the requested page of them */
async function groupedPage(
    query: { select: string; from: string; where: string; groupBy: string; orderBy: string },
    params: Record<string, unknown>,
    page: number,
    limit: number
) {
    const having = `HAVING SUM(SIT.LAVORO) > ${ANALYTICS.MIN_ROW_WORK_HOURS}`;
    const countResult = await queryMSSQL(`
        SELECT COUNT(*) as total
        FROM (SELECT 1 as dummy ${query.from} WHERE ${query.where} GROUP BY ${query.groupBy} ${having}) AS grouped_data
    `, params, 'NETPRO');

    const result = await queryMSSQL(`
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

const failure = (err: any, page: number, limit: number) => ({
    success: false,
    error: errorMessage(err),
    data: [],
    pagination: buildPaginationResult(page, limit, 0),
});

/**
 * ============================================================================
 * PRODUCTION REPORT: operator work time per date, machine, operator and order
 * ============================================================================
 */
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
        return await groupedPage({
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
        return failure(err, page, limit);
    }
}

/**
 * ============================================================================
 * ORDER SUMMARY REPORT (Sommario Ordini): operator work time per machine and order, all dates
 * ============================================================================
 */
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
        return await groupedPage({
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
        return failure(err, page, limit);
    }
}

/**
 * ============================================================================
 * AREA SUMMARY REPORT (Sommario Area): machine work time and speed per area
 * ============================================================================
 * Machine time (TIPO_OGGETTO 'MAC') per machine, summed per area. Quantity per area: the requested quantity of
 * each order once (the folding area: the sum of completed pieces), plus AREA_QUANTITY_EXCESS for the speed.
 */
interface AreaSummaryRow {
    area_name: string;
    work_time: number;
    requested_quantity: number;
    velocity: number;
    target_velocity: number;
    efficiency: number;
    machine_count: number;
    /** Position of the area in MACHINE_AREAS (production flow) */
    display_order: number;
}

const AREA_SUMMARY_SORT: RowSortColumns<AreaSummaryRow> = {
    area_name: (row) => row.area_name,
    requested_quantity: (row) => row.requested_quantity,
    work_time: (row) => row.work_time,
    velocity: (row) => row.velocity,
    efficiency: (row) => row.efficiency,
    display_order: (row) => row.display_order,
};

export async function getAreaSummaryDataAction(
    year: number = 2024,
    page: number = 1,
    limit: number = 100,
    filters?: {
        machine?: string; // area name filter
        dateFrom?: string;
        dateTo?: string;
    },
    sort?: SortConfig
) {
    try {
        const { conditions, params } = workFilter(year, 'MAC', filters);
        conditions.push('SIT.LAVORO > 0');
        const where = conditions.join(' AND ');

        // Work time per machine, without joins (a join would repeat the rows)
        const workTimeResult = await queryMSSQL<{ machine_code: string; work_time: number }>(`
            SELECT SIT.MACCHINA as machine_code, SUM(SIT.LAVORO) as work_time
            FROM SITUAZIONI SIT WITH (NOLOCK)
            WHERE ${where}
            GROUP BY SIT.MACCHINA
        `, params, 'NETPRO');

        // Quantities per machine and order (they belong to the order, not to the time rows)
        const quantityResult = await queryMSSQL<{ machine_code: string; ordine: number; requested_quantity: number; completed_quantity: number }>(`
            SELECT
                SIT.MACCHINA as machine_code,
                JST.ORDINE as ordine,
                MAX(ISNULL(JST.QTA_RICHIESTA, 0)) as requested_quantity,
                SUM(ISNULL(SIT.QTA_COMPLETATA, 0)) as completed_quantity
            FROM SITUAZIONI SIT WITH (NOLOCK)
            INNER JOIN JOBSET JST WITH (NOLOCK) ON SIT.TASK = JST.TASK
            WHERE ${where}
              AND (JST.QTA_RICHIESTA IS NULL OR JST.QTA_RICHIESTA >= ${ANALYTICS.AREA_MIN_REQUESTED_QTY})
            GROUP BY SIT.MACCHINA, JST.ORDINE
        `, params, 'NETPRO');

        const machineWorkTime = new Map(workTimeResult.recordset.map((row) => [row.machine_code, row.work_time]));
        const areaOfMachine = new Map(Object.entries(MACHINE_AREAS).flatMap(([area, codes]) => codes.map((code) => [code, area] as const)));

        // Quantity per area and order
        const orderQty = new Map<string, Map<number, number>>(Object.keys(MACHINE_AREAS).map((area) => [area, new Map()]));
        for (const row of quantityResult.recordset) {
            const area = areaOfMachine.get(row.machine_code);
            if (!area || !row.ordine) continue;
            const orders = orderQty.get(area)!;
            if (area === ANALYTICS.FOLDING_AREA) orders.set(row.ordine, (orders.get(row.ordine) || 0) + row.completed_quantity);
            else if (!orders.has(row.ordine)) orders.set(row.ordine, row.requested_quantity);
        }

        let rows: AreaSummaryRow[] = Object.entries(MACHINE_AREAS).map(([area_name, codes], index) => {
            const work_time = codes.reduce((sum, code) => sum + (machineWorkTime.get(code) || 0), 0);
            const requested_quantity = Array.from(orderQty.get(area_name)!.values()).reduce((sum, qty) => sum + qty, 0);
            const velocity = work_time > 0 ? (requested_quantity * ANALYTICS.AREA_QUANTITY_EXCESS) / work_time : 0;
            const target_velocity = ANALYTICS.AREA_TARGET_VELOCITY[area_name as keyof typeof ANALYTICS.AREA_TARGET_VELOCITY] || 0;
            return {
                area_name,
                work_time,
                requested_quantity,
                velocity,
                target_velocity,
                efficiency: target_velocity > 0 ? (velocity / target_velocity) * 100 : 0,
                machine_count: codes.length,
                display_order: index,
            };
        });

        if (filters?.machine) {
            const term = filters.machine.toLowerCase();
            rows = rows.filter((row) => row.area_name.toLowerCase().includes(term));
        }

        return { success: true, ...sortAndPage(rows, sort, AREA_SUMMARY_SORT, { column: 'display_order', direction: 'asc' }, undefined, page, limit) };
    } catch (err) {
        return failure(err, page, limit);
    }
}

/**
 * ============================================================================
 * ORDER AREA SUMMARY REPORT (Sommario Ordini per Area): operator work time per order and area
 * ============================================================================
 * Operator time per machine and order from SQL, summed per area in code. Areas with no expected speed and rows
 * under MIN_WORK_TIME_MINUTES are left out. Pages and composition come from Business (movord).
 */
interface OrderAreaRow {
    commessa_full: string;
    commessa_display: string;
    order_description: string;
    area_name: string;
    /** Position of the area in MACHINE_AREAS (production flow) */
    area_index: number;
    work_time: number;
    qty_requested: number | null;
    client_name: string | null;
    pages: number | null;
    composition: string | null;
    fogli: number | null;
}

/** Sheets of an order: the sum of the "N/" groups of its composition × the requested quantity */
function sheetsOf(composition: string | null, qtyRequested: number | null): number | null {
    if (!composition || qtyRequested == null) return null;
    const groups = Array.from(composition.matchAll(/(\d+)\s*\//g), (m) => parseInt(m[1], 10));
    return groups.length > 0 ? groups.reduce((sum, n) => sum + n, 0) * qtyRequested : null;
}

const ORDER_AREA_SORT: RowSortColumns<OrderAreaRow> = {
    // Default order: by order number, then areas in production order
    display_order: (row) => `${row.commessa_display}|${String(row.area_index).padStart(3, '0')}`,
    commessa: (row) => row.commessa_display,
    area: (row) => row.area_name,
    time: (row) => row.work_time,
    qty_requested: (row) => row.qty_requested,
    pages: (row) => row.pages,
    composition: (row) => row.composition,
    fogli: (row) => row.fogli,
    client_name: (row) => row.client_name,
};

/**
 * Order of the SQL rows before they are summed per area: it decides which machine row gives an order its
 * full number and description, so it follows the chosen column like before.
 */
const ORDER_AREA_SQL_SORT: Record<string, string> = {
    commessa: MIN_ORDER_CORE,
    time: 'SUM(SIT.LAVORO)',
    qty_requested: 'MAX(JST.QTA_RICHIESTA)',
};

export async function getOrderAreaSummaryDataAction(
    year: number = 2024,
    page: number = 1,
    limit: number = 100,
    filters?: {
        commessa?: string;
        area?: string;
        dateFrom?: string;
        dateTo?: string;
        complexOnly?: boolean;
    },
    sort?: SortConfig
) {
    try {
        const { conditions, params } = workFilter(year, 'OPE', filters);
        conditions.push('ORD.COMMESSA IS NOT NULL', `${ORDER_CORE} NOT IN (${ANALYTICS.EXCLUDED_ORDER_NUMBERS.map((n) => `'${n}'`).join(', ')})`);
        buildCommessaFilterNETPRO(filters?.commessa, conditions, params);

        const sqlSort = sort && ORDER_AREA_SQL_SORT[sort.column];
        const sqlOrderBy = sqlSort ? `${sqlSort} ${sort.direction.toUpperCase()}` : 'MIN(SIT.DATA) DESC, SIT.MACCHINA ASC';

        const rawResult = await queryMSSQL(`
            SELECT
                SIT.MACCHINA as machine_code,
                SUM(SIT.LAVORO) as work_time,
                MAX(JST.QTA_RICHIESTA) as qty_requested,
                MIN(ORD.COMMESSA) as commessa_full,
                ${MIN_ORDER_CORE} as commessa_display,
                MIN(ORD.DESCRIZIONE) as order_description,
                MAX(CCA.descr) as client_name
            ${WORK_ROWS}
            LEFT JOIN cliente_commessa_attivita CCA WITH (NOLOCK) ON ORD.COMMESSA = CCA.commessa
            WHERE ${conditions.join(' AND ')}
            GROUP BY SIT.MACCHINA, ${ORDER_CORE}
            HAVING SUM(SIT.LAVORO) > ${ANALYTICS.MIN_ROW_WORK_HOURS}
            ORDER BY ${sqlOrderBy}
        `, params, 'NETPRO');

        const areaOfMachine = new Map(
            Object.entries(MACHINE_AREAS).flatMap(([name, codes], index) => codes.map((code) => [code, { name, index }] as const))
        );

        // Sum per order + area; the first row of an order gives its full number and description
        const byOrderArea = new Map<string, Omit<OrderAreaRow, 'pages' | 'composition' | 'fogli'>>();
        for (const row of rawResult.recordset) {
            const area = areaOfMachine.get(row.machine_code);
            if (!area) continue; // machine not in any area
            const key = `${row.commessa_display}__${area.name}`;
            const existing = byOrderArea.get(key);
            if (existing) {
                existing.work_time += row.work_time || 0;
                if (row.qty_requested != null) existing.qty_requested = Math.max(existing.qty_requested ?? 0, row.qty_requested);
                if (row.client_name) existing.client_name = row.client_name;
            } else {
                byOrderArea.set(key, {
                    commessa_full: row.commessa_full,
                    commessa_display: row.commessa_display,
                    order_description: row.order_description,
                    area_name: area.name,
                    area_index: area.index,
                    work_time: row.work_time || 0,
                    qty_requested: row.qty_requested ?? null,
                    client_name: row.client_name || null,
                });
            }
        }

        const minHours = ANALYTICS.MIN_WORK_TIME_MINUTES / 60;
        const kept = Array.from(byOrderArea.values()).filter((row) => {
            const velocity = ANALYTICS.AREA_EXPECTED_VELOCITY[row.area_name as keyof typeof ANALYTICS.AREA_EXPECTED_VELOCITY] ?? 0;
            return velocity > 0 && row.work_time >= minHours;
        });

        // Pages and composition from Business
        const orderNumbers = Array.from(new Set(kept.map((row) => row.commessa_display)));
        const businessData = orderNumbers.length > 0 ? await fetchOrderBusinessData(orderNumbers) : {};
        let rows: OrderAreaRow[] = kept.map((row) => {
            const order = businessData[row.commessa_display];
            const composition = order?.composition || null;
            return { ...row, pages: order?.pages ?? null, composition, fogli: sheetsOf(composition, row.qty_requested) };
        });

        // "Solo complessi": orders worked in more than two areas
        if (filters?.complexOnly) {
            const areasPerOrder = new Map<string, number>();
            rows.forEach((row) => areasPerOrder.set(row.commessa_display, (areasPerOrder.get(row.commessa_display) || 0) + 1));
            rows = rows.filter((row) => (areasPerOrder.get(row.commessa_display) || 0) > 2);
        }

        if (filters?.area) {
            const term = filters.area.toLowerCase();
            rows = rows.filter((row) => row.area_name.toLowerCase().includes(term));
        }

        return { success: true, ...sortAndPage(rows, sort, ORDER_AREA_SORT, { column: 'display_order', direction: 'asc' }, undefined, page, limit) };
    } catch (err) {
        return failure(err, page, limit);
    }
}
