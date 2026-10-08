'use client';

import { errorMessage } from '@/lib/utils';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { countChangedFilters, readUrlFilters, writeUrlFilters } from '@/lib/urlFilters';
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
    /** Load straight away with the initial filters (default) instead of waiting for "Applica" */
    autoApply?: boolean;
}

/**
 * State and loading logic of a list that loads all its rows for the applied filters and sorts / filters them
 * on screen (operators, presence events, monthly hours): filters edited vs applied, loading, errors,
 * stale-response protection and reload after an edit. Loads as soon as it opens, with the filters of the address bar
 * (a shared link, a refresh) or else the initial ones. Paginated reports use useReportTable instead.
 */
export function useListQuery<F, Res extends ListResult<unknown>>({ initialFilters, load, autoApply = true }: UseListQueryOptions<F, Res>) {
    type R = RowOf<Res>;
    const [filters, setFilters] = useState<F>(initialFilters);
    const [applied, setApplied] = useState<F | null>(null);
    const [rows, setRows] = useState<R[]>([]);
    /** The whole last successful answer, for extra fields next to the rows */
    const [result, setResult] = useState<Res | null>(null);
    const [loading, setLoading] = useState(autoApply);
    const [error, setError] = useState<string | null>(null);

    // Only the latest request may update the list (a slow old response must not win)
    const requestId = useRef(0);
    const loadRef = useRef(load);
    const initialFiltersRef = useRef(initialFilters);
    const autoApplyRef = useRef(autoApply);
    useEffect(() => {
        loadRef.current = load;
        initialFiltersRef.current = initialFilters;
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
            if (id === requestId.current) setError(errorMessage(err));
        } finally {
            if (id === requestId.current) setLoading(false);
        }
    }, []);

    // First load: the filters in the address bar, or the initial ones when the list loads by itself
    useEffect(() => {
        const defaults = initialFiltersRef.current();
        const fromUrl = readUrlFilters(defaults, window.location.search);
        const start = fromUrl ? { ...defaults, ...fromUrl } : autoApplyRef.current ? defaults : null;
        if (!start) return;
        setFilters(start);
        setApplied(start);
        run(start);
    }, [run]);

    const updateFilters = useCallback((patch: Partial<F>) => {
        setFilters((prev) => ({ ...prev, ...patch }));
    }, []);

    const apply = () => {
        const query = { ...filters };
        setApplied(query);
        writeUrlFilters(query);
        return run(query);
    };

    /** Loads the applied filters again (after a save) */
    const reload = async () => {
        if (applied !== null) await run(applied);
    };

    const clear = () => {
        const fresh = initialFilters();
        requestId.current++;
        writeUrlFilters(null);
        setFilters(fresh);
        setRows([]);
        setResult(null);
        setError(null);
        if (autoApply) {
            setApplied(fresh);
            run(fresh);
        } else {
            setApplied(null);
            setLoading(false);
        }
    };

    // Filters applied apart from the defaults, for the folded filter bar on phones
    const activeFilterCount = useMemo(() => countChangedFilters(applied, initialFiltersRef.current()), [applied]);

    return { filters, updateFilters, applied, activeFilterCount, apply, clear, reload, rows, setRows, result, loading, error };
}
