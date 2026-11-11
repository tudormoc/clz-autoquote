'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { addressOf, patchAddress, readAddress, type AddressShape, type AddressValues } from '@/lib/address';

/** push = a new step, Back returns to the view before (opening something, "Applica"); replace = the same step (sort, page, chips) */
export type HistoryStep = 'push' | 'replace';

/** What a real link to another view of this page needs (ViewLink, TabBar) */
export interface ViewTarget {
    href: string;
    /** A plain click: changes the view in place, no page load */
    onOpen: () => void;
}

/**
 * Changes the query of the address in place: no page load, and every useAddress / useAppliedFilters on the page
 * follows. `update` edits the params and says which step this is; an address left as it was adds nothing to history.
 */
export function changeAddress(update: (params: URLSearchParams) => HistoryStep): void {
    const url = new URL(window.location.href);
    const before = url.searchParams.toString();
    const step = update(url.searchParams);
    const after = url.searchParams.toString();
    if (after === before) return;
    const address = `${addressOf(url.pathname, url.searchParams)}${url.hash}`;
    // Next follows the browser's own history calls: useSearchParams gives the new values, Back and Forward walk the steps
    if (step === 'push') window.history.pushState(null, '', address);
    else window.history.replaceState(null, '', address);
}

/**
 * The view values of a screen (tab, sort, page, chips …), read from the address and written back to it.
 * `shape` names each value and how it is read (src/lib/address.ts) and must stay the same object between renders
 * (a module constant, or kept in state). `values` change only when the address does.
 */
export function useAddress<S extends AddressShape>(shape: S) {
    const pathname = usePathname();
    const search = useSearchParams().toString();
    const key = JSON.stringify(readAddress(shape, new URLSearchParams(search)));
    const values = useMemo(() => JSON.parse(key) as AddressValues<S>, [key]);

    const set = useCallback(
        (patch: Partial<AddressValues<S>>, step: HistoryStep = 'push') =>
            changeAddress((params) => {
                patchAddress(shape, params, patch);
                return step;
            }),
        [shape]
    );

    /** A real link to this page with `patch` applied: a new tab opens that view, a plain click shows it in place */
    const link = (patch: Partial<AddressValues<S>>): ViewTarget => {
        const params = new URLSearchParams(search);
        patchAddress(shape, params, patch);
        return { href: addressOf(pathname, params), onOpen: () => set(patch) };
    };

    return { values, set, link };
}
