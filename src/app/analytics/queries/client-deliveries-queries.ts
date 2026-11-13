/**
 * Client Deliveries Queries
 * Delivered value (dw_valore of delivery notes, without the rows that deduct an advance) per client,
 * by movement date (dw_datmov), and how many orders it comes from.
 */

'use server';

import { errorMessage } from '@/lib/utils';
import sql from 'mssql';
import { BUSINESS_COMPANY } from '@/config/constants';
import { getMSSQLPool } from '@/lib/mssql';
import { DELIVERY_NOTE, NOT_ADVANCE_ROW, ORDER_COUNT } from './shared/business-report';
import { buildPaginationResult, calculateOffset, failedPage, ownEntry, sqlDirection, type SortConfig } from './shared/query-utils';
import { authorize } from '@/lib/auth/access';
import { LINKS } from '@/config/navigation';

export interface ClientDeliveryRow {
    client_code: number;
    client_name: string;
    delivered_value: number;
    /** Orders the delivered value comes from: the editions of one order count once */
    orders: number;
}

interface Filters {
    client?: string;
    dateFrom?: string;
    dateTo?: string;
}

/** UI sort key → SQL; anything else sorts by delivered value. Equal values are ordered by client code, so pages are stable. */
const SORT_COLUMNS: Record<string, string> = {
    client: 'an.an_conto',
    delivered_value: 'SUM(dw.dw_valore)',
    orders: ORDER_COUNT,
};

const CLIENT_ROWS = `
    FROM dwarehe dw WITH (NOLOCK)
    INNER JOIN anagra an WITH (NOLOCK)
        ON dw.dw_conto = an.an_conto
        AND dw.codditt = an.codditt`;

/**
 * A request on the Business pool with the parameters of the filters, and the matching WHERE clause
 * (delivery notes of clients, value ≠ 0, no advance rows). Parameters keep their SQL types so the indexes are used.
 */
async function deliveriesRequest(year: number, filters: Filters) {
    const pool = await getMSSQLPool('BUSINESS');
    const request = pool.request();

    const conditions: string[] = [
        'dw.dw_scenario = 1',
        'dw.codditt = @company',
        'dw.dw_anno >= @year',
        'an.an_tipo = @clientType',
        'dw.dw_valore <> 0',
        'dw.dw_tipork = @tipoRec',
        NOT_ADVANCE_ROW
    ];
    request.input('company', sql.VarChar, BUSINESS_COMPANY);
    request.input('year', sql.Int, year);
    request.input('clientType', sql.VarChar, 'C');
    request.input('tipoRec', sql.VarChar, DELIVERY_NOTE);

    if (filters.dateFrom) {
        conditions.push('dw.dw_datmov >= @dateFrom');
        request.input('dateFrom', sql.Date, filters.dateFrom);
    }
    if (filters.dateTo) {
        conditions.push('dw.dw_datmov <= @dateTo');
        request.input('dateTo', sql.Date, filters.dateTo);
    }

    // Several comma-separated clients: exact codes; one term: code or name contains it
    if (filters.client) {
        const clientCodes = filters.client.split(',').map(c => c.trim()).filter(Boolean);
        if (clientCodes.length > 1) {
            conditions.push(`an.an_conto IN (${clientCodes.map((_, i) => `@client${i}`).join(', ')})`);
            clientCodes.forEach((code, i) => request.input(`client${i}`, sql.VarChar, code));
        } else {
            conditions.push('(an.an_conto LIKE @clientSearch OR an.an_descr1 LIKE @clientSearch)');
            request.input('clientSearch', sql.VarChar, `%${filters.client}%`);
        }
    }

    return { request, where: conditions.join(' AND ') };
}

export async function getClientDeliveriesDataAction(
    year: number,
    page: number = 1,
    limit: number = 100,
    filters: Filters = {},
    sortConfig: SortConfig = { column: 'delivered_value', direction: 'desc' }
) {
    await authorize('view', LINKS.analytics['client-deliveries']);
    try {
        const { request, where } = await deliveriesRequest(year, filters);

        // Clients whose total is not zero
        const countResult = await request.query<{ total: number }>(`
            SELECT COUNT(*) as total
            FROM (
                SELECT an.an_conto
                ${CLIENT_ROWS}
                WHERE ${where}
                GROUP BY an.an_conto
                HAVING SUM(dw.dw_valore) <> 0
            ) AS filtered_clients
        `);
        const total = countResult.recordset[0].total;

        const sortColumn = ownEntry(SORT_COLUMNS, sortConfig.column) || SORT_COLUMNS.delivered_value;
        const sortDirection = sqlDirection(sortConfig.direction);
        request.input('offset', sql.Int, calculateOffset(page, limit));
        request.input('limit', sql.Int, limit);

        const dataResult = await request.query<ClientDeliveryRow>(`
            SELECT
                an.an_conto as client_code,
                MIN(an.an_descr1) as client_name,
                SUM(dw.dw_valore) as delivered_value,
                ${ORDER_COUNT} as orders
            ${CLIENT_ROWS}
            WHERE ${where}
            GROUP BY an.an_conto
            HAVING SUM(dw.dw_valore) <> 0
            ORDER BY ${sortColumn} ${sortDirection}${sortColumn === SORT_COLUMNS.client ? '' : ', an.an_conto'}
            OFFSET @offset ROWS
            FETCH NEXT @limit ROWS ONLY
        `);

        return { success: true, data: dataResult.recordset, pagination: buildPaginationResult(page, limit, total) };
    } catch (error) {
        console.error('Client deliveries query error:', error);
        return failedPage<ClientDeliveryRow>(error, page, limit);
    }
}

/** Total delivered value for the filters (summary card) */
export async function getClientDeliveriesStatsAction(year: number, filters: Filters = {}) {
    await authorize('view', LINKS.analytics['client-deliveries']);
    try {
        const { request, where } = await deliveriesRequest(year, filters);
        const result = await request.query<{ total_value: number | null }>(`
            SELECT SUM(dw.dw_valore) as total_value
            ${CLIENT_ROWS}
            WHERE ${where}
        `);
        return { success: true, data: { total_value: result.recordset[0]?.total_value || 0 } };
    } catch (error) {
        console.error('Client deliveries stats query error:', error);
        return {
            success: false,
            data: { total_value: 0 },
            error: errorMessage(error)
        };
    }
}
