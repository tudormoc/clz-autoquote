'use client';

import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { changeAddress } from '@/hooks/useAddress';
import { countChangedFilters, filtersKey, readFilters, writeFilters } from '@/lib/address';

/** What else of the address a list's "Applica" and "Pulisci" take back (a paged report: its page and order) */
interface AppliedView {
    /** True while the values "Applica" takes back are at their start (page 1) */
    atStart: boolean;
    /** Address values "Applica" removes */
    onApply: readonly string[];
    /** Address values "Pulisci" removes */
    onClear: readonly string[];
}

/**
 * The filters of a list: the ones being typed (kept here) and the ones applied (kept in the address).
 * "Applica" puts the typed filters in the address as a new history step; a link, a refresh or Back that brings an
 * address with filters shows them as applied at once; an address without any has nothing applied.
 * `run` goes up when "Applica" is pressed again on the same filters, so the list is read again.
 */
export function useAppliedFilters<F>(initialFilters: () => F, view: AppliedView) {
    const search = useSearchParams().toString();
    /** Which filters there are and of what kind (text, number, yes / no, list): how the address is read */
    const [defaults] = useState(initialFilters);
    const appliedKey = useMemo(() => filtersKey(readFilters(defaults, new URLSearchParams(search))), [defaults, search]);
    const applied = useMemo<F | null>(() => (appliedKey ? (JSON.parse(appliedKey) as F) : null), [appliedKey]);

    const [filters, setFilters] = useState<F>(() => applied ?? defaults);
    const [run, setRun] = useState(0);

    // Another address (Back, Forward, a link): the fields show its filters, or fresh ones when it has none
    const [shownKey, setShownKey] = useState(appliedKey);
    if (shownKey !== appliedKey) {
        setShownKey(appliedKey);
        setFilters(applied ?? initialFilters());
    }

    const updateFilters = useCallback((patch: Partial<F>) => {
        setFilters((prev) => ({ ...prev, ...patch }));
    }, []);

    const apply = () => {
        let same = false;
        changeAddress((params) => {
            writeFilters(params, defaults, filters);
            view.onApply.forEach((key) => params.delete(key));
            same = view.atStart && filtersKey(readFilters(defaults, params)) === appliedKey;
            return same ? 'replace' : 'push';
        });
        if (same) setRun((count) => count + 1);
    };

    const clear = () => {
        changeAddress((params) => {
            writeFilters(params, defaults, null);
            view.onClear.forEach((key) => params.delete(key));
            return 'push';
        });
        setFilters(initialFilters());
    };

    // Filters applied apart from the defaults, for the folded filter bar on phones
    const activeFilterCount = useMemo(() => countChangedFilters(applied, defaults), [applied, defaults]);

    return { filters, updateFilters, applied, activeFilterCount, apply, clear, run };
}
