/**
 * Shared Query Utilities
 * 
 * Common utilities for pagination, sorting, and parameter setup
 * used across all analytics queries.
 */

import type { SqlParams } from '@/lib/mssql';
import { errorMessage, faultKind, technicalMessage } from '@/lib/utils';
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

/** SQL keyword of a sort direction sent by the browser: 'asc' → ASC, anything else → DESC */
export const sqlDirection = (direction: string | undefined) => (direction === 'asc' ? 'ASC' : 'DESC');

/** The entry of `map` for a key sent by the browser (only the map's own keys count) */
export function ownEntry<V>(map: Record<string, V>, key: string | undefined): V | undefined {
    return key !== undefined && Object.hasOwn(map, key) ? map[key] : undefined;
}

/**
 * ORDER BY of a report sorted in SQL: `columns` maps the UI sort keys to SQL expressions. No sort → `defaultSort`;
 * an unknown key → the default column in the requested direction. `tieBreaker` (the GROUP BY columns) keeps pages
 * stable when values repeat.
 */
export function buildSqlOrderBy(
    columns: Record<string, string>,
    sort: SortConfig | undefined,
    defaultSort: SortConfig,
    tieBreaker: string
): string {
    const column = ownEntry(columns, sort?.column) || columns[defaultSort.column];
    const direction = sqlDirection(sort?.direction ?? defaultSort.direction);
    // SQL Server rejects a column listed twice
    const ties = tieBreaker.split(',').map((t) => t.trim()).filter((t) => t !== column);
    return [`${column} ${direction}`, ...ties].join(', ');
}

/**
 * Sorts all rows of a report, then cuts the requested page. For reports whose rows are built or completed after the
 * query (labour cost from NetPro, areas), so every column sorts on the value shown. No sort → `defaultSort`; an
 * unknown sort key → the default column in the requested direction. The tie-breaker keeps pages stable.
 */
export function sortAndPage<T>(
    rows: T[],
    sort: SortConfig | undefined,
    columns: RowSortColumns<T>,
    defaultSort: SortConfig,
    tieBreaker: ((row: T) => string) | undefined,
    page: number,
    limit: number
): { data: T[]; pagination: PaginationResult } {
    const value = ownEntry(columns, sort?.column) || columns[defaultSort.column];
    const direction = sort?.direction ?? defaultSort.direction;
    const sorted = sortRows(rows, value, direction, tieBreaker && ((a, b) => tieBreaker(a).localeCompare(tieBreaker(b))));
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
    params: SqlParams
): string {
    if (!commessaInput) return '';

    const commessaTerms = commessaInput.split(',').map(c => c.trim()).filter(c => c);
    if (commessaTerms.length === 1) {
        params.commessaDesc = `%${commessaTerms[0]}%`;
        return ' WHERE (cr.commessa_display LIKE @commessaDesc OR co.co_descr1 LIKE @commessaDesc)';
    }
    
    return '';
}

/** The 4-digit order number shown to users, from a NetPro `ORDINI.COMMESSA` code (docs/DATABASE.md) */
export function netproOrderCore(column: string): string {
    return `SUBSTRING(${column}, 4, 4)`;
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

/** Error text for a failed report query: a timeout gets a hint, anything else the text of any failure (errorMessage) */
export function queryErrorMessage(err: unknown): string {
    return faultKind(err) === 'timeout' || /timeout/i.test(technicalMessage(err)) ? APP_COPY.analytics.common.queryTimeout : errorMessage(err);
}

/** A report page that failed: no rows, an empty page and the error text */
export function failedPage<T = never>(err: unknown, page: number, limit: number) {
    return { success: false, error: queryErrorMessage(err), data: [] as T[], pagination: buildPaginationResult(page, limit, 0) };
}
