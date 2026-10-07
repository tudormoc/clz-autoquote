'use client';

import { useEffect, useRef, useState } from 'react';
import { refreshOrderOperationsManagementAction, syncOrderFromDibaAction } from '@/app/analytics/queries/order-operations-queries';
import { notify } from '@/lib/notify';
import { errorMessage } from '@/lib/utils';
import { APP_COPY } from '@/locales';
import type { OrderOperationsManagementData } from '@/types';

const t = APP_COPY.analytics.orderOperations;

/**
 * Comparison of an order with its DiBa (Business and NetPro): the data shown, reloading it (also for another edition) and
 * the realign from DiBa. `onStatusChange` reports whether the order is aligned whenever the data changes.
 */
export function useOrderManagement(
    initial: OrderOperationsManagementData,
    rootCommessaKey: string,
    onStatusChange?: (hasDiscrepancies: boolean, count: number) => void
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
    useEffect(() => {
        statusCallback.current?.(hasDiscrepancies, discrepancyCount);
    }, [hasDiscrepancies, discrepancyCount]);

    /** Loads the data again from the databases, for one edition if given; true when it worked */
    const reload = async (articleFather?: string, commessaFull?: string) => {
        if (!rootCommessaKey) return false;
        setRefreshing(true);
        try {
            const res = await refreshOrderOperationsManagementAction(rootCommessaKey, articleFather, commessaFull);
            if (res.success && res.operationsManagement) {
                setData(res.operationsManagement);
                return true;
            }
            notify.error(res.error || t.errorSaving);
        } catch (err) {
            notify.error(errorMessage(err) || t.errorSaving);
        } finally {
            setRefreshing(false);
        }
        return false;
    };

    return {
        data,
        refreshing,
        syncing,
        refresh: () => reload(data.article_father, data.commessa_full),
        selectEdition: (commessaFull: string) => (commessaFull === data.commessa_full ? undefined : reload(undefined, commessaFull)),
        /** Rewrites the Business and NetPro order from the DiBa, then reloads; true when it worked */
        sync: async () => {
            if (!rootCommessaKey) return false;
            setSyncing(true);
            try {
                const res = await syncOrderFromDibaAction({ rootCommessaKey, articleFather: data.article_father });
                if (!res.success) {
                    notify.error(res.error || t.errorSaving);
                    return false;
                }
                notify.success(res.message || t.syncSuccess);
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
