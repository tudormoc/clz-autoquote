'use client';

import { useState } from 'react';
import { getMisalignedOrdersAction, refreshMisalignedOrderAction, syncOrderFromDibaAction } from '@/app/analytics/queries/order-operations-queries';
import { notify } from '@/lib/notify';
import type { MisalignedOrder, MisalignedOrders } from '@/lib/orders/types';
import { errorMessage } from '@/lib/utils';
import { APP_COPY } from '@/locales';

const t = APP_COPY.analytics.orderOperations;

/**
 * "Ordini da riallineare": the list is compared on the server only when asked for (`load`), and `clear` puts it away.
 * One row can be read again (`refreshOrder`) or realigned from its DiBa (`syncOrder`, which writes to Business and NetPro).
 */
export function useMisalignedOrders() {
    const [data, setData] = useState<MisalignedOrders | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    /** The rows being read again or realigned (NetPro order ids) */
    const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());

    /** A failed load leaves no list on screen, only its error */
    const fail = (message: string) => {
        setData(null);
        setError(message);
    };

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await getMisalignedOrdersAction();
            if (result.success) setData({ checked: result.checked, orders: result.orders });
            else fail(result.error || APP_COPY.analytics.error);
        } catch (err) {
            fail(errorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    const clear = () => {
        setData(null);
        setError(null);
    };

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
        clear,
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
                    await reread(order.netproOrder);
                    return true;
                } catch (err) {
                    notify.error(errorMessage(err) || t.errorSaving);
                    return false;
                }
            }),
    };
}
