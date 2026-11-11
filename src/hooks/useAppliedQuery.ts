'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppliedFilters } from '@/hooks/useAppliedFilters';
import { errorMessage } from '@/lib/utils';
import { APP_COPY } from '@/locales';

/** What a server action that loads something answers */
export interface QueryAnswer {
    success: boolean;
    error?: string | null;
}

interface UseAppliedQueryOptions<F, Res> {
    /** Fresh filter values (called again by "Pulisci", so dates are recomputed) */
    initialFilters: () => F;
    load: (filters: F) => Promise<Res>;
    /** View values of the screen that "Pulisci" takes back too (its chips, what is opened): their names in the address */
    clears?: readonly string[];
}

const NOTHING: readonly string[] = [];

/**
 * Filters and loading of a screen that reads everything it shows in one go for the applied filters (a list, a month,
 * a year): filters typed vs applied (the applied ones live in the address, see useAppliedFilters), loading, errors,
 * stale-response protection and reload after an edit. A page opened without filters in its address loads nothing
 * until "Applica"; an address with filters (a link, a refresh, Back) loads at once.
 * Lists of rows use useListQuery (built on this), paged reports useReportTable.
 */
export function useAppliedQuery<F, Res extends QueryAnswer>({ initialFilters, load, clears = NOTHING }: UseAppliedQueryOptions<F, Res>) {
    const form = useAppliedFilters(initialFilters, { atStart: true, onApply: NOTHING, onClear: clears });
    const { applied, run } = form;
    /** The last successful answer */
    const [result, setResult] = useState<Res | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Only the latest request may update the screen (a slow old response must not win)
    const requestId = useRef(0);
    const loadRef = useRef(load);
    useEffect(() => {
        loadRef.current = load;
    });

    const read = useCallback(async (query: F) => {
        const id = ++requestId.current;
        setLoading(true);
        try {
            const answer = await loadRef.current(query);
            if (id !== requestId.current) return;
            if (answer.success) {
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

    useEffect(() => {
        if (applied !== null) {
            void read(applied);
            return;
        }
        requestId.current++;
        setResult(null);
        setError(null);
        setLoading(false);
    }, [applied, run, read]);

    /** Loads the applied filters again (after a save) */
    const reload = async () => {
        if (applied !== null) await read(applied);
    };

    return {
        filters: form.filters,
        updateFilters: form.updateFilters,
        applied,
        activeFilterCount: form.activeFilterCount,
        apply: form.apply,
        clear: form.clear,
        reload,
        result,
        setResult,
        loading,
        error,
    };
}
