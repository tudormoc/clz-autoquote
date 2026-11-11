'use client';

import { useCallback, useMemo } from 'react';
import { useAppliedQuery, type QueryAnswer } from '@/hooks/useAppliedQuery';

/** Shape returned by list server actions (all rows at once, no paging) */
export interface ListResult<R> extends QueryAnswer {
    data?: R[];
}

/** Row type of a list result */
type RowOf<Res> = Res extends { data?: (infer R)[] } ? R : never;

interface UseListQueryOptions<F, Res> {
    /** Fresh filter values (called again by "Pulisci", so dates are recomputed) */
    initialFilters: () => F;
    load: (filters: F) => Promise<Res>;
    /** View values of the list that "Pulisci" takes back too (its chips): their names in the address */
    clears?: readonly string[];
}

/**
 * State and loading logic of a list that loads all its rows for the applied filters and sorts / filters them
 * on screen (operators, presence events, monthly hours): see useAppliedQuery, this adds the rows.
 * Paginated reports use useReportTable instead.
 */
export function useListQuery<F, Res extends ListResult<unknown>>(options: UseListQueryOptions<F, Res>) {
    type R = RowOf<Res>;
    const query = useAppliedQuery<F, Res>(options);
    const { result, setResult } = query;

    const rows = useMemo(() => (result?.data ?? []) as R[], [result]);

    /** Changes rows in place (a cell saved on its own), without reading the list again */
    const setRows = useCallback(
        (update: (rows: R[]) => R[]) => setResult((prev) => prev && { ...prev, data: update((prev.data ?? []) as R[]) }),
        [setResult]
    );

    return { ...query, rows, setRows };
}
