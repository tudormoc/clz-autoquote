'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getMisalignedOrdersAction, refreshMisalignedOrderAction, syncOrderFromDibaAction } from '@/app/analytics/queries/order-operations-queries';
import { notify } from '@/lib/notify';
import type { MisalignedOrder, MisalignedOrders } from '@/lib/orders/types';
import { errorMessage } from '@/lib/utils';
import { APP_COPY } from '@/locales';

const t = APP_COPY.analytics.orderOperations;

/**
 * "Ordini da riallineare": the list is compared on the server only when asked for: when the address shows it (`shown`:
 * the button, a link, a refresh) and nothing was read yet, or again with `load`. Coming back to it shows what was read.
 * One row can be read again (`refreshOrder`) or realigned from its DiBa (`syncOrder`, which writes to Business and NetPro).
 */
export function useMisalignedOrders(shown: boolean) {
    const [data, setData] = useState<MisalignedOrders | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    /** The rows being read again or realigned (NetPro order ids) */
    const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());

    /** A comparison is running: asking again meanwhile changes nothing */
    const comparing = useRef(false);
    /** A list was read and is still here */
    const read = useRef(false);

    const load = useCallback(async () => {
        if (comparing.current) return;
        comparing.current = true;
        setLoading(true);
        setError(null);
        /** A failed load leaves no list on screen, only its error */
        const fail = (message: string) => {
            read.current = false;
            setData(null);
            setError(message);
        };
        try {
            const result = await getMisalignedOrdersAction();
            if (result.success) {
                read.current = true;
                setData({ checked: result.checked, orders: result.orders });
            } else fail(result.error || APP_COPY.analytics.error);
        } catch (err) {
            fail(errorMessage(err));
        } finally {
            comparing.current = false;
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (shown && !read.current) void load();
    }, [shown, load]);

    /** Runs `work` with the row marked busy */
    const working = async <T,>(netproOrder: string, work: () => Promise<T>): Promise<T> => {
        setBusy((previous) => new Set(previous).add(netproOrder));
        try {
            return await work();
        } finally {
            setBusy((previous) => new Set(Array.from(previous).filter((id) => id !== netproOrder)));
        }
    };

    /** Reads a row again and puts it in the place of the old one; an order no longer open leaves the list. Undefined = the read failed */
    const reread = async (netproOrder: string): Promise<MisalignedOrder | null | undefined> => {
        try {
            const result = await refreshMisalignedOrderAction(netproOrder);
            if (!result.success) {
                notify.failure(result.error);
                return undefined;
            }
            const fresh = result.order;
            setData((previous) =>
                previous && {
                    ...previous,
                    orders: fresh ? previous.orders.map((order) => (order.netproOrder === netproOrder ? fresh : order)) : previous.orders.filter((order) => order.netproOrder !== netproOrder),
                }
            );
            if (!fresh) notify.info(t.misaligned.closed);
            return fresh;
        } catch (err) {
            notify.failure(err);
            return undefined;
        }
    };

    return {
        data,
        loading,
        error,
        busy,
        load,
        refreshOrder: (order: MisalignedOrder) => working(order.netproOrder, () => reread(order.netproOrder)),
        /** Rewrites the Business and NetPro order of the row from the DiBa, then reads the row again; true when it worked */
        syncOrder: (order: MisalignedOrder) =>
            working(order.netproOrder, async () => {
                try {
                    const result = await syncOrderFromDibaAction({ commessa: order.commessa, netproOrder: order.netproOrder });
                    if (!result.success) {
                        notify.error(result.error || t.errorSaving);
                        return false;
                    }
                    notify.success(t.syncSuccess);
                    // What stayed on the order because it was already used
                    if (result.kept.length > 0) notify.info(result.kept.join(' '));
                    await reread(order.netproOrder);
                    return true;
                } catch (err) {
                    notify.error(errorMessage(err) || t.errorSaving);
                    return false;
                }
            }),
    };
}
