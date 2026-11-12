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

/** Something read for certain applied filters: the filters, and which "Applica" press, it belongs to */
interface ReadFor<F, T> {
    value: T;
    applied: F;
    run: number;
}

/**
 * Filters and loading of a screen that reads everything it shows in one go for the applied filters (a list, a month,
 * a year): filters typed vs applied (the applied ones live in the address, see useAppliedFilters), loading, errors,
 * stale-response protection and reload after an edit. A page opened without filters in its address loads nothing
 * until "Applica"; an address with filters (a link, a refresh, Back) loads at once.
 *
 * `result` and `error` are always those of the applied filters, or null: an answer to the filters before is never
 * shown, or exported, under the new ones, not while the new ones are read and not when that read fails. Only a
 * `reload` of the same filters (after a save) keeps what is on screen until the new answer is there.
 * Lists of rows use useListQuery (built on this), paged reports useReportTable.
 */
export function useAppliedQuery<F, Res extends QueryAnswer>({ initialFilters, load, clears = NOTHING }: UseAppliedQueryOptions<F, Res>) {
    const form = useAppliedFilters(initialFilters, { atStart: true, onApply: NOTHING, onClear: clears });
    const { applied, run } = form;
    /** The last answer and the last failure, each with the filters it is for */
    const [answer, setAnswer] = useState<ReadFor<F, Res> | null>(null);
    const [failure, setFailure] = useState<ReadFor<F, string> | null>(null);
    const [reading, setReading] = useState(false);

    // Decided while drawing, not a moment later in an effect: what was read for other filters is not on screen at all
    const isCurrent = (read: ReadFor<F, unknown> | null) => read !== null && read.applied === applied && read.run === run;
    const result = answer !== null && isCurrent(answer) ? answer.value : null;
    const error = failure !== null && isCurrent(failure) ? failure.value : null;
    const loading = reading || (applied !== null && result === null && error === null);

    // Only the latest request may update the screen (a slow old response must not win)
    const requestId = useRef(0);
    const loadRef = useRef(load);
    useEffect(() => {
        loadRef.current = load;
    });

    const read = useCallback(async (query: F, press: number) => {
        const id = ++requestId.current;
        setReading(true);
        const failed = (message: string) => setFailure({ value: message, applied: query, run: press });
        try {
            const value = await loadRef.current(query);
            if (id !== requestId.current) return;
            if (value.success) {
                setAnswer({ value, applied: query, run: press });
                setFailure(null);
            } else {
                failed(value.error ?? APP_COPY.common.loadError);
            }
        } catch (err) {
            if (id === requestId.current) failed(errorMessage(err));
        } finally {
            if (id === requestId.current) setReading(false);
        }
    }, []);

    useEffect(() => {
        if (applied !== null) {
            void read(applied, run);
            return;
        }
        // "Pulisci": an answer still on its way is for filters that were taken back
        requestId.current++;
        setReading(false);
    }, [applied, run, read]);

    /** Loads the applied filters again (after a save): what is on screen stays until the new answer is there */
    const reload = async () => {
        if (applied !== null) await read(applied, run);
    };

    /** Changes the answer on screen in place (a row saved on its own), without reading again */
    const setResult = useCallback((update: (current: Res | null) => Res | null) => {
        setAnswer((held) => {
            if (held === null) return held;
            const value = update(held.value);
            return value === null ? null : { ...held, value };
        });
    }, []);

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
