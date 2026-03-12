/**
 * Client Deliveries Queries
 * Shows client deliveries with delivered value (dw_valore) and invoice/movement date (dw_datmov)
 */

'use server';

import { getMSSQLPool } from '@/lib/mssql';
import sql from 'mssql';

interface ClientDeliveryRow {
    client_code: string;
    client_name: string;
    delivered_value: number;
}

interface Filters {
    client?: string;
    dateFrom?: string;
    dateTo?: string;
}

interface SortConfig {
    column: string;
    direction: 'asc' | 'desc';
}

interface PaginationResult {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export async function getClientDeliveriesDataAction(
    year: number,
    page: number = 1,
    limit: number = 100,
    filters: Filters = {},
    sortConfig: SortConfig = { column: 'delivery_date', direction: 'desc' },
    skipPagination: boolean = false
): Promise<{
    success: boolean;
    data: ClientDeliveryRow[];
    pagination: PaginationResult;
    error?: string;
}> {
    try {
        const pool = await getMSSQLPool('BUSINESS');
        const request = pool.request();

        // Build WHERE conditions
        const conditions: string[] = [
            'dw.dw_scenario = 1',
            'dw.codditt = @company',
            'dw.dw_anno >= @year',
            'an.an_tipo = @clientType',
            'dw.dw_valore <> 0'
        ];

        request.input('company', sql.VarChar, 'COOPZANARDI');
        request.input('year', sql.Int, year);
        request.input('clientType', sql.VarChar, 'C');

        // Date filters on dw_datmov
        if (filters.dateFrom) {
            conditions.push('dw.dw_datmov >= @dateFrom');
            request.input('dateFrom', sql.Date, filters.dateFrom);
        }
        if (filters.dateTo) {
            conditions.push('dw.dw_datmov <= @dateTo');
            request.input('dateTo', sql.Date, filters.dateTo);
        }

        // Client filter (fuzzy search on code or name)
        if (filters.client) {
            const clientCodes = filters.client.split(',').map(c => c.trim()).filter(Boolean);
            if (clientCodes.length > 1) {
                // Multiple clients: exact match
                const clientParams = clientCodes.map((_, i) => `@client${i}`).join(', ');
                conditions.push(`an.an_conto IN (${clientParams})`);
                clientCodes.forEach((code, i) => {
                    request.input(`client${i}`, sql.VarChar, code);
                });
            } else {
                // Single client: fuzzy search
                conditions.push('(an.an_conto LIKE @clientSearch OR an.an_descr1 LIKE @clientSearch)');
                request.input('clientSearch', sql.VarChar, `%${filters.client}%`);
            }
        }

        const whereClause = conditions.join(' AND ');

        // Sort mapping
        const sortColumns: Record<string, string> = {
            'client': 'an.an_conto',
            'delivered_value': 'SUM(dw.dw_valore)'
        };
        const sortColumn = sortColumns[sortConfig.column] || 'SUM(dw.dw_valore)';
        const sortDirection = sortConfig.direction === 'asc' ? 'ASC' : 'DESC';

        // Count query - count distinct clients
        const countQuery = `
            SELECT COUNT(DISTINCT an.an_conto) as total
            FROM dwarehe dw WITH (NOLOCK)
            INNER JOIN anagra an WITH (NOLOCK)
                ON dw.dw_conto = an.an_conto
                AND dw.codditt = an.codditt
            WHERE ${whereClause}
        `;

        const countResult = await request.query(countQuery);
        const total = countResult.recordset[0].total;
        const totalPages = Math.ceil(total / limit);

        // Data query with pagination
        const offset = skipPagination ? 0 : (page - 1) * limit;
        const fetchLimit = skipPagination ? total : limit;

        const dataQuery = `
            SELECT 
                an.an_conto as client_code,
                MIN(an.an_descr1) as client_name,
                SUM(dw.dw_valore) as delivered_value
            FROM dwarehe dw WITH (NOLOCK)
            INNER JOIN anagra an WITH (NOLOCK)
                ON dw.dw_conto = an.an_conto
                AND dw.codditt = an.codditt
            WHERE ${whereClause}
            GROUP BY an.an_conto
            ORDER BY ${sortColumn} ${sortDirection}
            OFFSET @offset ROWS
            FETCH NEXT @limit ROWS ONLY
        `;

        request.input('offset', sql.Int, offset);
        request.input('limit', sql.Int, fetchLimit);

        const dataResult = await request.query(dataQuery);

        return {
            success: true,
            data: dataResult.recordset,
            pagination: {
                total,
                page,
                limit,
                totalPages
            }
        };
    } catch (error) {
        console.error('Client deliveries query error:', error);
        return {
            success: false,
            data: [],
            pagination: { total: 0, page, limit, totalPages: 0 },
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Statistics for Client Deliveries
 * Returns the total aggregated delivered value for the current filters
 */
export async function getClientDeliveriesStatsAction(
    year: number,
    filters: Filters = {}
): Promise<{
    success: boolean;
    data: { total_value: number };
    error?: string;
}> {
    try {
        const pool = await getMSSQLPool('BUSINESS');
        const request = pool.request();

        // Build WHERE conditions (identical to main query)
        const conditions: string[] = [
            'dw.dw_scenario = 1',
            'dw.codditt = @company',
            'dw.dw_anno >= @year',
            'an.an_tipo = @clientType',
            'dw.dw_valore <> 0'
        ];

        request.input('company', sql.VarChar, 'COOPZANARDI');
        request.input('year', sql.Int, year);
        request.input('clientType', sql.VarChar, 'C');

        if (filters.dateFrom) {
            conditions.push('dw.dw_datmov >= @dateFrom');
            request.input('dateFrom', sql.Date, filters.dateFrom);
        }
        if (filters.dateTo) {
            conditions.push('dw.dw_datmov <= @dateTo');
            request.input('dateTo', sql.Date, filters.dateTo);
        }

        if (filters.client) {
            const clientCodes = filters.client.split(',').map(c => c.trim()).filter(Boolean);
            if (clientCodes.length > 1) {
                const clientParams = clientCodes.map((_, i) => `@client${i}`).join(', ');
                conditions.push(`an.an_conto IN (${clientParams})`);
                clientCodes.forEach((code, i) => {
                    request.input(`client${i}`, sql.VarChar, code);
                });
            } else {
                conditions.push('(an.an_conto LIKE @clientSearch OR an.an_descr1 LIKE @clientSearch)');
                request.input('clientSearch', sql.VarChar, `%${filters.client}%`);
            }
        }

        const whereClause = conditions.join(' AND ');

        // Aggregate query
        const query = `
            SELECT SUM(dw.dw_valore) as total_value
            FROM dwarehe dw WITH (NOLOCK)
            INNER JOIN anagra an WITH (NOLOCK)
                ON dw.dw_conto = an.an_conto
                AND dw.codditt = an.codditt
            WHERE ${whereClause}
        `;

        const result = await request.query(query);

        return {
            success: true,
            data: {
                total_value: result.recordset[0]?.total_value || 0
            }
        };
    } catch (error) {
        console.error('Client deliveries stats query error:', error);
        return {
            success: false,
            data: { total_value: 0 },
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}
