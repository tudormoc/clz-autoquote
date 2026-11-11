'use client';

import { useCallback, useMemo, useState } from 'react';
import { useAddress } from '@/hooks/useAddress';
import { sortParam } from '@/lib/address';
import { nextSort, sortRows, type RowSortColumns, type SortState } from '@/lib/sort';

/**
 * Sorting done on screen, for lists that hold all their rows. `columns` maps each sortable column key
 * (the DataTable column key) to its value and must be stable (a module constant or useMemo).
 * The order lives in the address (?sort=column.desc, left out when it is the usual one), so a link or a refresh
 * keeps it; changing it stays on the same history step. One sorted list per page.
 */
export function useClientSort<R>(
    rows: R[],
    columns: RowSortColumns<R>,
    initial: SortState,
    tieBreaker?: (a: R, b: R) => number
) {
    const [usual] = useState(initial);
    const [shape] = useState(() => ({ sort: sortParam(usual) }));
    const { values, set } = useAddress(shape);
    // An address that asks for a column this list does not have gets the usual order
    const sort = values.sort && columns[values.sort.column] ? values.sort : usual;

    const sorted = useMemo(() => {
        const value = columns[sort.column];
        return value ? sortRows(rows, value, sort.direction, tieBreaker) : rows;
    }, [rows, columns, sort, tieBreaker]);

    const toggleSort = useCallback((column: string) => set({ sort: nextSort(sort, column) }, 'replace'), [set, sort]);

    return { sorted, sort, toggleSort };
}
