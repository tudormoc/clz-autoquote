'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getOrderOperationsAction, getSingleOrderDetailsAction } from '@/app/analytics/queries/order-operations-queries';
import { APP_CONFIG } from '@/config/constants';
import type { MasterOrderMatch, OrderDetailsData } from '@/lib/orders/types';
import { errorMessage } from '@/lib/utils';
import { APP_COPY } from '@/locales';

const t = APP_COPY.analytics.orderOperations;

/** The open order; `loadId` changes with every load, so what the screen keeps about it starts again */
export interface OrderDetails extends OrderDetailsData {
    loadId: number;
    /** The master order it is (the first characters of its commessa): how the address names it */
    key: string;
}

const rootKeyOf = (data: OrderDetailsData) => data.editions[0]?.commessa_full?.slice(0, APP_CONFIG.ORDERS.ROOT_KEY_LENGTH) ?? '';

interface OrderSearchOptions {
    /** The search in the address ('' = none) */
    term: string;
    /** The order in the address ('' = none) */
    orderKey: string;
    /** A search found one order alone: it is shown under its own address */
    onOnlyMatch: (rootCommessaKey: string) => void;
}

/**
 * The search and the open order of Avanzamento Lavori, both named by the address (useOrderAddress): a search by commessa
 * number or description lists its matches (one alone opens at once); an order is read whenever the address names one,
 * again every time it is opened.
 */
export function useOrderSearch({ term, orderKey, onOnlyMatch }: OrderSearchOptions) {
    const [matches, setMatches] = useState<MasterOrderMatch[]>([]);
    const [loaded, setLoaded] = useState<OrderDetails | null>(null);
    const [searching, setSearching] = useState(false);
    const [opening, setOpening] = useState(false);
    /** The search, or the order named, found nothing */
    const [noMatch, setNoMatch] = useState(false);
    const [noOrder, setNoOrder] = useState(false);
    const [error, setError] = useState<string | null>(null);
    /** Goes up when the same search is asked again */
    const [run, setRun] = useState(0);

    const loads = useRef(0);
    // The latest values, for answers that come back later
    const loadedKey = useRef('');
    const orderKeyNow = useRef(orderKey);
    const onOnlyMatchNow = useRef(onOnlyMatch);
    useEffect(() => {
        orderKeyNow.current = orderKey;
        onOnlyMatchNow.current = onOnlyMatch;
    });

    const keep = useCallback((data: OrderDetailsData, key: string) => {
        loadedKey.current = key;
        setLoaded({ loadId: ++loads.current, key, editions: data.editions, operations: data.operations, materials: data.materials, management: data.management });
    }, []);

    useEffect(() => {
        setMatches([]);
        setNoMatch(false);
        if (!term) {
            setSearching(false);
            return;
        }
        let current = true;
        setSearching(true);
        setError(null);
        getOrderOperationsAction(term)
            .then((result) => {
                if (!current) return;
                if (!result.success) setError(result.error || APP_COPY.analytics.error);
                else if (result.status === 'multiple') setMatches(result.matches);
                else if (result.status === 'single' && rootKeyOf(result)) {
                    // An address that already names an order keeps it
                    if (orderKeyNow.current) return;
                    keep(result, rootKeyOf(result));
                    onOnlyMatchNow.current(rootKeyOf(result));
                } else setNoMatch(true);
            })
            .catch((err: unknown) => {
                if (current) setError(errorMessage(err));
            })
            .finally(() => {
                if (current) setSearching(false);
            });
        return () => {
            current = false;
        };
    }, [term, run, keep]);

    useEffect(() => {
        setNoOrder(false);
        setError(null);
        if (!orderKey) {
            // Closed: the next time it is opened it is read again
            loadedKey.current = '';
            setLoaded(null);
            setOpening(false);
            return;
        }
        // Just found alone by a search: already here
        if (loadedKey.current === orderKey) return;
        let current = true;
        setOpening(true);
        getSingleOrderDetailsAction(orderKey)
            .then((result) => {
                if (!current) return;
                if (!result.success) setError(result.error || APP_COPY.analytics.error);
                else if (result.editions.length === 0) setNoOrder(true);
                else keep(result, orderKey);
            })
            .catch((err: unknown) => {
                if (current) setError(errorMessage(err));
            })
            .finally(() => {
                if (current) setOpening(false);
            });
        return () => {
            current = false;
        };
    }, [orderKey, keep]);

    const loading = searching || opening;
    return {
        matches,
        /** The order the address names, once read */
        order: loaded && loaded.key === orderKey ? loaded : null,
        loading,
        /** What to say when there is nothing to show */
        message: loading ? null : noMatch || noOrder ? t.noResults : !term && !orderKey ? t.enterSearch : null,
        error,
        /** Runs the search in the address again */
        again: () => setRun((count) => count + 1),
    };
}
