/**
 * Shared Query Utilities
 * 
 * Common utilities for pagination, sorting, and parameter setup
 * used across all analytics queries.
 */

/**
 * Standard sort configuration
 */
export interface SortConfig {
    column: string;
    direction: 'asc' | 'desc';
}

/**
 * Standard pagination result
 */
export interface PaginationResult {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

/**
 * Calculate pagination offset
 */
export function calculateOffset(page: number, limit: number): number {
    return (page - 1) * limit;
}

/**
 * Build pagination result object
 */
export function buildPaginationResult(
    page: number,
    limit: number,
    total: number
): PaginationResult {
    return {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
    };
}

/**
 * Build ORDER BY clause for production-related queries (NETPRO)
 */
export function buildProductionOrderBy(
    sortColumn: string = 'date',
    sortDirection: 'asc' | 'desc' = 'asc'
): string {
    const direction = sortDirection.toUpperCase();
    
    switch (sortColumn) {
        case 'date':
            return `SIT.DATA ${direction}`;
        case 'commessa':
            return `SUBSTRING(MIN(ORD.COMMESSA), 4, 4) ${direction}`;
        case 'machine':
            return `SIT.MACCHINA ${direction}`;
        case 'operator':
            return `SIT.OGGETTO ${direction}`;
        case 'time':
            return `SUM(SIT.LAVORO) ${direction}`;
        case 'qty':
            return `SUM(SIT.QTA_COMPLETATA) ${direction}`;
        case 'qty_requested':
            return `MAX(JST.QTA_RICHIESTA) ${direction}`;
        default:
            return `SIT.DATA ${direction}`;
    }
}

/**
 * Build ORDER BY clause for order summary queries (NETPRO, grouped by machine)
 */
export function buildOrderSummaryOrderBy(
    sortColumn: string = 'commessa',
    sortDirection: 'asc' | 'desc' = 'asc'
): string {
    const direction = sortDirection.toUpperCase();
    
    switch (sortColumn) {
        case 'commessa':
            return `SUBSTRING(MIN(ORD.COMMESSA), 4, 4) ${direction}`;
        case 'machine':
            return `SIT.MACCHINA ${direction}`;
        case 'time':
            return `SUM(SIT.LAVORO) ${direction}`;
        case 'qty':
            return `SUM(SIT.QTA_COMPLETATA) ${direction}`;
        case 'qty_requested':
            return `MAX(JST.QTA_RICHIESTA) ${direction}`;
        default:
            return `SUBSTRING(MIN(ORD.COMMESSA), 4, 4) ${direction}`;
    }
}

/**
 * Build ORDER BY clause for client summary queries (BUSINESS)
 */
export function buildClientSummaryOrderBy(
    sortColumn: string = 'revenue',
    sortDirection: 'asc' | 'desc' = 'desc'
): string {
    const direction = sortDirection.toUpperCase();
    
    switch (sortColumn) {
        case 'client':
            return `cr.client_code ${direction}`;
        case 'orders':
            return `cr.total_orders ${direction}`;
        case 'revenue':
            return `cr.total_revenue ${direction}`;
        case 'cost':
            return `ISNULL(SUM(sc.commessa_cost), 0) ${direction}`;
        case 'work_cost':
            return `cr.total_revenue ${direction}`;
        case 'margin':
            return `(cr.total_revenue - ISNULL(SUM(sc.commessa_cost), 0)) ${direction}`;
        case 'quantity':
            return `cr.total_quantity ${direction}`;
        case 'last_order':
            return `cr.client_code ${direction}`;
        default:
            return `cr.total_revenue ${direction}`;
    }
}

/**
 * Build ORDER BY clause for order revenue queries (BUSINESS)
 * Note: This returns the raw ORDER BY that needs string replacements for CTE columns
 */
export function buildOrderRevenueOrderBy(
    sortColumn: string = 'revenue',
    sortDirection: 'asc' | 'desc' = 'desc'
): string {
    const direction = sortDirection.toUpperCase();
    
    switch (sortColumn) {
        case 'commessa':
            return `RIGHT(CAST(MIN(dw.dw_commeca) / 100 AS VARCHAR), 4) ${direction}`;
        case 'client':
            return `MIN(CASE WHEN an.an_tipo = 'C' THEN an.an_conto END) ${direction}`;
        case 'revenue':
            return `SUM(CASE WHEN an.an_tipo = 'C' THEN dw.dw_valfatt ELSE 0 END) ${direction}`;
        case 'cost':
            return `SUM(CASE WHEN an.an_tipo = 'F' THEN dw.dw_acqvalore ELSE 0 END) ${direction}`;
        case 'margin':
            return `(SUM(CASE WHEN an.an_tipo = 'C' THEN dw.dw_valfatt ELSE 0 END) - SUM(CASE WHEN an.an_tipo = 'F' THEN dw.dw_acqvalore ELSE 0 END)) ${direction}`;
        case 'quantity':
            return `SUM(CASE WHEN an.an_tipo = 'C' THEN dw.dw_collifatt ELSE 0 END) ${direction}`;
        default:
            return `SUM(CASE WHEN an.an_tipo = 'C' THEN dw.dw_valfatt ELSE 0 END) ${direction}`;
    }
}

/**
 * Transform ORDER BY clause for use after CTE in order revenue queries
 * Replaces raw table references with CTE column references
 */
export function transformOrderByForCTE(orderByClause: string): string {
    return orderByClause
        .replace('MIN(dw.dw_commeca)', 'cr.commessa_full')
        .replace('MIN(CASE WHEN an.an_tipo = \'C\' THEN an.an_conto END)', 'cr.client_code')
        .replace('SUM(CASE WHEN an.an_tipo = \'C\' THEN dw.dw_valfatt ELSE 0 END)', 'cr.total_revenue')
        .replace('SUM(CASE WHEN an.an_tipo = \'F\' THEN dw.dw_acqvalore ELSE 0 END)', 'ISNULL(sc.total_cost, 0)')
        .replace('(SUM(CASE WHEN an.an_tipo = \'C\' THEN dw.dw_valfatt ELSE 0 END) - SUM(CASE WHEN an.an_tipo = \'F\' THEN dw.dw_acqvalore ELSE 0 END))', '(cr.total_revenue - ISNULL(sc.total_cost, 0))')
        .replace('SUM(CASE WHEN an.an_tipo = \'C\' THEN dw.dw_collifatt ELSE 0 END)', 'cr.total_quantity')
        .replace('RIGHT(CAST(MIN(dw.dw_commeca) / 100 AS VARCHAR), 4)', 'RIGHT(CAST(cr.commessa_full / 100 AS VARCHAR), 4)');
}

/**
 * Setup base date parameters for queries
 */
export function setupDateParams(
    year: number,
    dateFrom?: string,
    dateTo?: string
): { startDate: string; endDate: string } {
    return {
        startDate: dateFrom || `${year}-01-01`,
        endDate: dateTo || `${year + 2}-12-31`
    };
}

/**
 * Build post-CTE filter for commessa description search
 * Used in order revenue queries where description is joined after CTE
 */
export function buildPostCTECommessaFilter(
    commessaInput: string | undefined,
    params: Record<string, any>
): string {
    if (!commessaInput) return '';

    const commessaTerms = commessaInput.split(',').map(c => c.trim()).filter(c => c);
    if (commessaTerms.length === 1) {
        // Single term: also search in description after CTE
        params.commessaDesc = `%${commessaTerms[0]}%`;
        return ' WHERE (cr.commessa_display LIKE @commessaDesc OR co.co_descr1 LIKE @commessaDesc)';
    }
    
    return '';
}
