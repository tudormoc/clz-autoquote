'use client';

import { useRef, useState } from 'react';
import {
    getOrderOperationsAction,
    getSingleOrderDetailsAction,
    type MasterOrderMatch,
    type Material,
} from '@/app/analytics/queries/order-operations-queries';
import type { FlowOperation } from '@/lib/orderFlow';
import { APP_COPY } from '@/locales';
import type { OrderEdition, OrderOperationsManagementData } from '@/types';

const t = APP_COPY.analytics.orderOperations;

/** Everything shown for one order (all its editions) */
export interface OrderDetails {
    /** Changes with every load, so the screen starts again from its first tab */
    loadId: number;
    operations: FlowOperation[];
    editions: OrderEdition[];
    materials: Material[];
    management: OrderOperationsManagementData;
}

const EMPTY_MANAGEMENT: OrderOperationsManagementData = { article_father: '', ordine_netpro: '', diba_operations: [], order_operations: [] };

/** Answer of the two order actions, as far as the screen needs it */
interface OrderAnswer {
    data: unknown[];
    editions: unknown[];
    materials?: Material[];
    operationsManagement?: OrderOperationsManagementData;
}

/** Search by commessa number or description: one match opens the order, several are listed to choose from. */
export function useOrderSearch() {
    const [term, setTerm] = useState('');
    const [matches, setMatches] = useState<MasterOrderMatch[]>([]);
    const [order, setOrder] = useState<OrderDetails | null>(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(t.enterSearch);
    const [error, setError] = useState<string | null>(null);
    const loads = useRef(0);

    const openOrder = (answer: OrderAnswer) =>
        setOrder({
            loadId: ++loads.current,
            operations: answer.data as FlowOperation[],
            editions: answer.editions as OrderEdition[],
            materials: answer.materials ?? [],
            management: answer.operationsManagement ?? EMPTY_MANAGEMENT,
        });

    const search = async () => {
        setOrder(null);
        setMatches([]);
        setError(null);
        if (!term.trim()) {
            setMessage(t.enterSearch);
            return;
        }

        setLoading(true);
        setMessage(null);
        const result = await getOrderOperationsAction(term);
        if (!result.success) setError(result.error || APP_COPY.analytics.error);
        else if (result.status === 'single') openOrder(result);
        else if (result.status === 'multiple') setMatches(result.matches);
        else setMessage(t.noResults);
        setLoading(false);
    };

    /** Opens one of the listed matches (the list stays, "back" returns to it) */
    const select = async (rootCommessaKey: string) => {
        setLoading(true);
        setError(null);
        const result = await getSingleOrderDetailsAction(rootCommessaKey);
        if (result.success) openOrder(result);
        else setError(result.error || APP_COPY.analytics.error);
        setLoading(false);
    };

    return { term, setTerm, matches, order, loading, message, error, search, select, back: () => setOrder(null) };
}
