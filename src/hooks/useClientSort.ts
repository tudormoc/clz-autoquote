'use client';

import { useCallback, useMemo, useState } from 'react';
import { nextSort, sortRows, type RowSortColumns, type SortState } from '@/lib/sort';

/**
 * Sorting done on screen, for lists that hold all their rows. `columns` maps each sortable column key
 * (the DataTable column key) to its value and must be stable (a module constant or useMemo).
 */
export function useClientSort<R>(
    rows: R[],
    columns: RowSortColumns<R>,
    initial: SortState,
    tieBreaker?: (a: R, b: R) => number
) {
    const [sort, setSort] = useState<SortState>(initial);

    const sorted = useMemo(() => {
        const value = columns[sort.column];
        return value ? sortRows(rows, value, sort.direction, tieBreaker) : rows;
    }, [rows, columns, sort, tieBreaker]);

    const toggleSort = useCallback((column: string) => setSort((prev) => nextSort(prev, column)), []);

    return { sorted, sort, toggleSort };
}
