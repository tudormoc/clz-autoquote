/**
 * SUPPLIER QUERIES
 * 
 * Track supplier invoicing by order (commessa).
 * Shows which suppliers were used for each order and their costs.
 * 
 * DATA SOURCE: BUSINESS database
 * - dwarehe: Supplier invoicing data
 * - anagra: Supplier names
 * - commess: Order descriptions
 */

'use server'

import { queryMSSQL } from '@/lib/mssql';
import { APP_CONFIG } from '@/config/constants';

interface SupplierFilters {
    commessa?: string;
    supplier?: string;
    dateFrom?: string;
    dateTo?: string;
}

interface SortConfig {
    column: string;
    direction: 'asc' | 'desc';
}

/**
 * ============================================================================
 * SUPPLIER SUMMARY BY ORDER
 * ============================================================================
 * 
 * Shows supplier costs grouped by commessa (order).
 * One commessa can have multiple suppliers.
 * 
 * COLUMNS:
 * - commessa_display: 4-digit order number
 * - commessa_full: Full order number
 * - order_description: Order description from commess table
 * - supplier_code: Supplier account code
 * - supplier_name: Supplier name
 * - total_value: Sum of dw_acqvalore (delivered value)
 * 
 * FILTERS:
 * - dw_contropis IN (5093, 5096, 5095) - Contropartita codes
 * - an_tipo = 'F' - Only suppliers (Fornitori)
 * - dw_scenario = 1 - Actual data
 * - dw_commeca > 0 - Exclude general expenses
 * 
 * ============================================================================
 */
export async function getSupplierSummaryAction(
    year: number,
    page: number = 1,
    limit: number = 100,
    filters?: SupplierFilters,
    sortConfig?: SortConfig
) {
    try {
        const offset = (page - 1) * limit;
        const params: any = { year, offset, limit };

        // Build WHERE conditions
        const conditions: string[] = [
            'dw.dw_scenario = 1',
            "dw.codditt = 'COOPZANARDI'",
            'dw.dw_anno >= @year',
            "an.an_tipo = 'F'",
            'dw.dw_commeca > 0',
            'dw.dw_acqvalore <> 0',
            `dw.dw_controp IN (${APP_CONFIG.ANALYTICS.SUPPLIER_CONTROPARTITA_CODES.join(', ')})`
        ];

        // Date filters
        if (filters?.dateFrom) {
            conditions.push('dw.dw_datmov >= @dateFrom');
            params.dateFrom = filters.dateFrom;
        }
        if (filters?.dateTo) {
            conditions.push('dw.dw_datmov <= @dateTo');
            params.dateTo = filters.dateTo;
        }

        // Commessa filter (fuzzy search on 4-digit display)
        if (filters?.commessa) {
            const commessaTerm = `%${filters.commessa}%`;
            conditions.push('RIGHT(CAST(dw.dw_commeca / 100 AS VARCHAR), 4) LIKE @commessaTerm');
            params.commessaTerm = commessaTerm;
        }

        // Supplier filter (fuzzy search on code or name)
        if (filters?.supplier) {
            const supplierTerm = `%${filters.supplier}%`;
            conditions.push('(an.an_conto LIKE @supplierTerm OR an.an_descr1 LIKE @supplierTerm)');
            params.supplierTerm = supplierTerm;
        }

        const whereClause = conditions.join(' AND ');

        // Build ORDER BY clause
        let orderBy = 'ORDER BY supplier_name ASC, commessa_display DESC';
        if (sortConfig) {
            const direction = sortConfig.direction.toUpperCase();
            switch (sortConfig.column) {
                case 'commessa':
                    orderBy = `ORDER BY commessa_display ${direction}`;
                    break;
                case 'supplier':
                    orderBy = `ORDER BY supplier_name ${direction}`;
                    break;
                case 'value':
                    orderBy = `ORDER BY total_value ${direction}`;
                    break;
            }
        }

        // Get total count
        const countResult = await queryMSSQL(`
            SELECT COUNT(*) as total
            FROM (
                SELECT 
                    RIGHT(CAST(dw.dw_commeca / 100 AS VARCHAR), 4) as commessa_display,
                    dw.dw_conto as supplier_code
                FROM dwarehe dw WITH (NOLOCK)
                INNER JOIN anagra an WITH (NOLOCK)
                    ON dw.dw_conto = an.an_conto
                    AND dw.codditt = an.codditt
                WHERE ${whereClause}
                GROUP BY RIGHT(CAST(dw.dw_commeca / 100 AS VARCHAR), 4), dw.dw_commeca, dw.dw_conto, an.an_descr1
            ) as subquery
        `, params, 'BUSINESS');

        const total = countResult.recordset[0].total;
        const totalPages = Math.ceil(total / limit);

        // Get paginated data
        const result = await queryMSSQL(`
            SELECT 
                RIGHT(CAST(dw.dw_commeca / 100 AS VARCHAR), 4) as commessa_display,
                dw.dw_commeca as commessa_full,
                dw.dw_conto as supplier_code,
                an.an_descr1 as supplier_name,
                SUM(dw.dw_acqvalore) as total_value,
                co.co_descr1 as order_description
            FROM dwarehe dw WITH (NOLOCK)
            INNER JOIN anagra an WITH (NOLOCK)
                ON dw.dw_conto = an.an_conto
                AND dw.codditt = an.codditt
            LEFT JOIN commess co WITH (NOLOCK)
                ON dw.dw_commeca = co.co_comme
                AND dw.codditt = co.codditt
            WHERE ${whereClause}
            GROUP BY 
                RIGHT(CAST(dw.dw_commeca / 100 AS VARCHAR), 4),
                dw.dw_commeca,
                dw.dw_conto,
                an.an_descr1,
                co.co_descr1
            ${orderBy}
            OFFSET @offset ROWS
            FETCH NEXT @limit ROWS ONLY
        `, params, 'BUSINESS');

        return {
            success: true,
            data: result.recordset,
            pagination: {
                page,
                limit,
                total,
                totalPages
            }
        };
    } catch (err: any) {
        return {
            success: false,
            error: err.message,
            data: [],
            pagination: {
                page: 1,
                limit: 100,
                total: 0,
                totalPages: 0
            }
        };
    }
}


/**
 * ============================================================================
 * SUPPLIER SUMMARY STATISTICS
 * ============================================================================
 * 
 * Calculates aggregated statistics for filtered supplier data.
 * 
 * RETURNS:
 * - total_value: Overall sum of all delivered values
 * - suppliers: Array of {supplier_name, total_value} grouped by supplier
 * 
 * Uses same filters as main query for consistency.
 * ============================================================================
 */
export async function getSupplierSummaryStatsAction(
    year: number,
    filters?: SupplierFilters
) {
    try {
        const params: any = { year };

        // Build WHERE conditions (same as main query)
        const conditions: string[] = [
            'dw.dw_scenario = 1',
            "dw.codditt = 'COOPZANARDI'",
            'dw.dw_anno >= @year',
            "an.an_tipo = 'F'",
            'dw.dw_commeca > 0',
            'dw.dw_acqvalore <> 0',
            `dw.dw_controp IN (${APP_CONFIG.ANALYTICS.SUPPLIER_CONTROPARTITA_CODES.join(', ')})`
        ];

        // Date filters
        if (filters?.dateFrom) {
            conditions.push('dw.dw_datmov >= @dateFrom');
            params.dateFrom = filters.dateFrom;
        }
        if (filters?.dateTo) {
            conditions.push('dw.dw_datmov <= @dateTo');
            params.dateTo = filters.dateTo;
        }

        // Commessa filter
        if (filters?.commessa) {
            const commessaTerm = `%${filters.commessa}%`;
            conditions.push('RIGHT(CAST(dw.dw_commeca / 100 AS VARCHAR), 4) LIKE @commessaTerm');
            params.commessaTerm = commessaTerm;
        }

        // Supplier filter
        if (filters?.supplier) {
            const supplierTerm = `%${filters.supplier}%`;
            conditions.push('(an.an_conto LIKE @supplierTerm OR an.an_descr1 LIKE @supplierTerm)');
            params.supplierTerm = supplierTerm;
        }

        const whereClause = conditions.join(' AND ');

        // Get supplier breakdown
        const result = await queryMSSQL(`
            SELECT 
                an.an_descr1 as supplier_name,
                SUM(dw.dw_acqvalore) as total_value
            FROM dwarehe dw WITH (NOLOCK)
            INNER JOIN anagra an WITH (NOLOCK)
                ON dw.dw_conto = an.an_conto
                AND dw.codditt = an.codditt
            WHERE ${whereClause}
            GROUP BY an.an_descr1
            ORDER BY total_value DESC
        `, params, 'BUSINESS');

        // Calculate overall total
        const totalValue = result.recordset.reduce((sum, row) => sum + row.total_value, 0);

        return {
            success: true,
            data: {
                total_value: totalValue,
                suppliers: result.recordset
            }
        };
    } catch (err: any) {
        return {
            success: false,
            error: err.message,
            data: {
                total_value: 0,
                suppliers: []
            }
        };
    }
}
