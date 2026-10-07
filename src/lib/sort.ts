/**
 * Row sorting shared by the server (reports sorted after the query) and the browser (lists sorted on screen).
 */

export type SortDirection = 'asc' | 'desc';

export interface SortState {
    column: string;
    direction: SortDirection;
}

export type SortValue = number | string | null | undefined;

/** UI sort key → the row value it sorts on */
export type RowSortColumns<T> = Record<string, (row: T) => SortValue>;

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

const isEmpty = (value: SortValue): value is null | undefined | '' =>
    value === null || value === undefined || value === '' || (typeof value === 'number' && Number.isNaN(value));

/** Numbers by size; text ignoring case, with numbers inside it in natural order ("OP9" before "OP10") */
export function compareValues(a: SortValue, b: SortValue): number {
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    return collator.compare(String(a), String(b));
}

/**
 * Sorted copy of `rows`. Empty values always go last, whatever the direction;
 * rows with equal values keep the `tieBreaker` order (or their current order).
 */
export function sortRows<T>(
    rows: T[],
    value: (row: T) => SortValue,
    direction: SortDirection,
    tieBreaker?: (a: T, b: T) => number
): T[] {
    const sign = direction === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
        const va = value(a);
        const vb = value(b);
        const emptyA = isEmpty(va);
        const emptyB = isEmpty(vb);
        if (emptyA || emptyB) {
            if (emptyA && emptyB) return tieBreaker?.(a, b) ?? 0;
            return emptyA ? 1 : -1;
        }
        return compareValues(va, vb) * sign || (tieBreaker?.(a, b) ?? 0);
    });
}

/** Sort after a click on a column header: the same column flips direction, a new column starts ascending */
export function nextSort(previous: SortState | null, column: string): SortState {
    return { column, direction: previous?.column === column && previous.direction === 'asc' ? 'desc' : 'asc' };
}
