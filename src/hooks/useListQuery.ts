'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { APP_COPY } from '@/locales';

/** Shape returned by list server actions (all rows at once, no paging) */
export interface ListResult<R> {
    success: boolean;
    data?: R[];
    error?: string | null;
}

/** Row type of a list result */
type RowOf<Res> = Res extends { data?: (infer R)[] } ? R : never;

interface UseListQueryOptions<F, Res> {
    /** Fresh filter values (called again by "Pulisci", so dates are recomputed) */
    initialFilters: () => F;
    load: (filters: F) => Promise<Res>;
}

/**
 * State and loading logic of a list that loads all its rows for the applied filters and sorts / filters them
 * on screen (operators, presence events, monthly hours): filters edited vs applied, loading, errors,
 * stale-response protection and reload after an edit. Paginated reports use useReportTable instead.
 */
export function useListQuery<F, Res extends ListResult<unknown>>({ initialFilters, load }: UseListQueryOptions<F, Res>) {
    type R = RowOf<Res>;
    const [filters, setFilters] = useState<F>(initialFilters);
    const [applied, setApplied] = useState<F | null>(null);
    const [rows, setRows] = useState<R[]>([]);
    /** The whole last successful answer, for extra fields next to the rows */
    const [result, setResult] = useState<Res | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Only the latest request may update the list (a slow old response must not win)
    const requestId = useRef(0);
    const loadRef = useRef(load);
    useEffect(() => {
        loadRef.current = load;
    });

    const run = useCallback(async (query: F) => {
        const id = ++requestId.current;
        setLoading(true);
        try {
            const answer = await loadRef.current(query);
            if (id !== requestId.current) return;
            if (answer.success) {
                setRows((answer.data ?? []) as R[]);
                setResult(answer);
                setError(null);
            } else {
                setError(answer.error ?? APP_COPY.common.loadError);
            }
        } catch (err) {
            if (id === requestId.current) setError(err instanceof Error ? err.message : String(err));
        } finally {
            if (id === requestId.current) setLoading(false);
        }
    }, []);

    const updateFilters = useCallback((patch: Partial<F>) => {
        setFilters((prev) => ({ ...prev, ...patch }));
    }, []);

    const apply = () => {
        const query = { ...filters };
        setApplied(query);
        return run(query);
    };

    /** Loads the applied filters again (after a save) */
    const reload = async () => {
        if (applied !== null) await run(applied);
    };

    const clear = () => {
        requestId.current++;
        setFilters(initialFilters());
        setApplied(null);
        setRows([]);
        setResult(null);
        setError(null);
        setLoading(false);
    };

    return { filters, updateFilters, applied, apply, clear, reload, rows, setRows, result, loading, error };
}
