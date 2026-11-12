'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { refreshOrderOperationsManagementAction, syncOrderFromDibaAction } from '@/app/analytics/queries/order-operations-queries';
import { notify } from '@/lib/notify';
import { errorMessage } from '@/lib/utils';
import { APP_COPY } from '@/locales';
import type { OrderOperationsManagementData } from '@/types';

const t = APP_COPY.analytics.orderOperations;

/**
 * Comparison of an order with its DiBa (Business and NetPro): the data shown, reloading it (also for another edition) and
 * the realign from DiBa. `edition` is the commessa of the edition to compare, as the address names it: another one is
 * read when it is not the one shown. `onStatusChange` reports whether the order is aligned whenever the data changes.
 */
export function useOrderManagement(
    initial: OrderOperationsManagementData,
    rootCommessaKey: string,
    edition: string,
    onStatusChange?: (hasDiscrepancies: boolean, count: number, notRead: boolean) => void
) {
    const [data, setData] = useState(initial);
    const [refreshing, setRefreshing] = useState(false);
    const [syncing, setSyncing] = useState(false);

    const statusCallback = useRef(onStatusChange);
    useEffect(() => {
        statusCallback.current = onStatusChange;
    });
    const hasDiscrepancies = data.has_discrepancies ?? false;
    const discrepancyCount = data.discrepancy_count ?? 0;
    const notRead = Boolean(data.load_error);
    useEffect(() => {
        statusCallback.current?.(hasDiscrepancies, discrepancyCount, notRead);
    }, [hasDiscrepancies, discrepancyCount, notRead]);

    // Only the latest read may update the screen (two editions asked for one after the other)
    const reads = useRef(0);

    /** Loads the data again from the databases, for one edition if given; true when it worked */
    const reload = useCallback(
        async (articleFather?: string, commessaFull?: string) => {
            if (!rootCommessaKey) return false;
            const id = ++reads.current;
            setRefreshing(true);
            try {
                const res = await refreshOrderOperationsManagementAction(rootCommessaKey, articleFather, commessaFull);
                if (id !== reads.current) return false;
                // Also when the read failed: the screen then says "not read" (load_error) instead of keeping the
                // comparison from before, which after a realign would no longer be true
                setData(res.operationsManagement);
                if (res.success) return true;
                notify.error(res.error || t.errorSaving);
            } catch (err) {
                if (id === reads.current) notify.error(errorMessage(err) || t.errorSaving);
            } finally {
                if (id === reads.current) setRefreshing(false);
            }
            return false;
        },
        [rootCommessaKey]
    );

    // The edition the address names (another one picked, Back, a link) is read when it is not the one on screen
    const shownEdition = useRef(data.commessa_full);
    useEffect(() => {
        shownEdition.current = data.commessa_full;
    });
    useEffect(() => {
        if (edition && edition !== shownEdition.current) void reload(undefined, edition);
    }, [edition, reload]);

    return {
        data,
        refreshing,
        syncing,
        refresh: () => reload(data.article_father, data.commessa_full),
        /** Rewrites the Business and NetPro order of the edition shown from its DiBa, then reloads; true when it worked */
        sync: async () => {
            if (!data.commessa_full) {
                notify.error(t.syncNoOrder);
                return false;
            }
            setSyncing(true);
            try {
                const res = await syncOrderFromDibaAction({ commessa: data.commessa_full, netproOrder: data.ordine_netpro || undefined });
                if (!res.success) {
                    notify.error(res.error || t.errorSaving);
                    return false;
                }
                notify.success(t.syncSuccess);
                // What stayed on the order because it was already used
                if (res.kept.length > 0) notify.info(res.kept.join(' '));
                await reload(data.article_father, data.commessa_full);
                return true;
            } catch (err) {
                notify.error(errorMessage(err) || t.errorSaving);
                return false;
            } finally {
                setSyncing(false);
            }
        },
    };
}
