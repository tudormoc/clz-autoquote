/**
 * Shared Query Utilities
 * 
 * Common utilities for pagination, sorting, and parameter setup
 * used across all analytics queries.
 */

import { APP_COPY } from '@/locales';
import { sortRows, type RowSortColumns, type SortState } from '@/lib/sort';

/** Sort requested by a report (UI column key + direction) */
export type SortConfig = SortState;
export type { RowSortColumns };

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
 * Build ORDER BY clause for order area summary queries (NETPRO, grouped by machine + commessa).
 * Area grouping is handled in the application layer (post-SQL), but pre-grouping sort is still needed.
 */
export function buildOrderAreaSummaryOrderBy(
    sortColumn: string = '',
    sortDirection: 'asc' | 'desc' = 'asc'
): string {
    const direction = sortDirection.toUpperCase();

    switch (sortColumn) {
        case 'commessa':
            return `SUBSTRING(MIN(ORD.COMMESSA), 4, 4) ${direction}`;
        case 'time':
            return `SUM(SIT.LAVORO) ${direction}`;
        case 'qty_requested':
            return `MAX(JST.QTA_RICHIESTA) ${direction}`;
        default:
            // Natural order: by date (newest first) if no sort is specified
            return `MIN(SIT.DATA) DESC, SIT.MACCHINA ASC`;
    }
}

/**
 * Sorts all rows of a report, then cuts the requested page. For reports whose rows are completed after the query
 * (labour cost from NetPro), so every column, margin included, sorts on the value shown. An unknown sort key uses
 * `fallback` (descending when no sort is given); the tie-breaker keeps the order stable across pages.
 */
export function sortAndPage<T>(
    rows: T[],
    sort: SortConfig | undefined,
    columns: RowSortColumns<T>,
    fallback: string,
    tieBreaker: (row: T) => string,
    page: number,
    limit: number
): { data: T[]; pagination: PaginationResult } {
    const value = (sort && columns[sort.column]) || columns[fallback];
    const sorted = sortRows(rows, value, sort?.direction ?? 'desc', (a, b) => tieBreaker(a).localeCompare(tieBreaker(b)));
    const offset = calculateOffset(page, limit);
    return { data: sorted.slice(offset, offset + limit), pagination: buildPaginationResult(page, limit, rows.length) };
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
 * Commessa search by description, once `commess` is joined (alias `co`, rows alias `cr` with `commessa_display`).
 * Pair it with `buildCommessaFilterBUSINESS(…, true)`, which skips the single-term filter on the order rows.
 */
export function buildCommessaDescriptionFilter(
    commessaInput: string | undefined,
    params: Record<string, any>
): string {
    if (!commessaInput) return '';

    const commessaTerms = commessaInput.split(',').map(c => c.trim()).filter(c => c);
    if (commessaTerms.length === 1) {
        params.commessaDesc = `%${commessaTerms[0]}%`;
        return ' WHERE (cr.commessa_display LIKE @commessaDesc OR co.co_descr1 LIKE @commessaDesc)';
    }
    
    return '';
}

/** The 4-digit order number shown to users, from a Business `dw_commeca` code (docs/DATABASE.md) */
export function businessOrderCore(column: string): string {
    return `RIGHT(CAST(${column} / 100 AS VARCHAR), 4)`;
}

/**
 * Fills `#OrderCodes` with every full `dw_commeca` code (any year) of the orders listed in `table.column`.
 * Later steps join `dwarehe` on these codes through its `dw_commeca` index; joining on the computed 4-digit
 * number instead reads all ~15M rows (30 s and more).
 */
export function businessOrderCodesSql(table: string, column: string): string {
    return `
        SELECT k.dw_commeca
        INTO #OrderCodes
        FROM (SELECT DISTINCT dw_commeca FROM dwarehe WITH (NOLOCK) WHERE dw_commeca > 0) k
        WHERE ${businessOrderCore('k.dw_commeca')} IN (SELECT ${column} FROM ${table});`;
}

/** Drops temp tables; used at the start of a batch (left over from a failed run on the same connection) and at the end */
export function dropTempTablesSql(tables: string[]): string {
    return tables.map((table) => `DROP TABLE IF EXISTS ${table};`).join(' ');
}

/** Error text for a failed report query: a timeout gets a hint, anything else its own message */
export function queryErrorMessage(err: unknown): string {
    const message = err instanceof Error ? err.message : String(err);
    return /timeout/i.test(message) ? APP_COPY.analytics.common.queryTimeout : message;
}
