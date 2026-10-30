'use server'

/**
 * Server actions of the work progress page. The queries are in src/lib/orders/ (details, comparison, realign).
 */
import { fetchOrderDetails, findMasterOrders } from '@/lib/orders/details';
import { emptyManagement, fetchOrderManagement } from '@/lib/orders/management';
import { syncOrderFromDiba } from '@/lib/orders/sync';
import type { MasterOrderMatch, OrderDetailsData } from '@/lib/orders/types';
import { errorMessage } from '@/lib/utils';
import type { OrderOperationsManagementData } from '@/types';
import { authorize } from '@/lib/auth/access';
import { LINKS, WORK_PROGRESS_FUNCTIONS } from '@/config/navigation';

type Failure = { success: false; error: string };

export type OrderSearchResult =
    | { success: true; status: 'empty' }
    | { success: true; status: 'multiple'; matches: MasterOrderMatch[] }
    | ({ success: true; status: 'single' } & OrderDetailsData)
    | Failure;

/** Search: no match, several master orders to choose from, or the only one already opened */
export async function getOrderOperationsAction(searchTerm: string): Promise<OrderSearchResult> {
    await authorize('view', LINKS.workProgress);
    try {
        if (!searchTerm.trim()) return { success: true, status: 'empty' };
        const matches = await findMasterOrders(searchTerm);
        if (matches.length === 0) return { success: true, status: 'empty' };
        if (matches.length === 1) return { success: true, status: 'single', ...(await fetchOrderDetails(matches[0].root_commessa_key)) };
        return { success: true, status: 'multiple', matches };
    } catch (err) {
        return { success: false, error: errorMessage(err) };
    }
}

/** One master order picked from the search results */
export async function getSingleOrderDetailsAction(rootCommessaKey: string): Promise<({ success: true } & OrderDetailsData) | Failure> {
    await authorize('view', LINKS.workProgress);
    try {
        return { success: true, ...(await fetchOrderDetails(rootCommessaKey)) };
    } catch (err) {
        return { success: false, error: errorMessage(err) };
    }
}

/** Reloads the DiBa comparison (of one edition when `commessaFull` is given) */
export async function refreshOrderOperationsManagementAction(
    rootCommessaKey: string,
    articleHint?: string,
    commessaFull?: string
): Promise<{ success: true; operationsManagement: OrderOperationsManagementData } | (Failure & { operationsManagement: OrderOperationsManagementData })> {
    await authorize('view', LINKS.workProgress);
    try {
        return { success: true, operationsManagement: await fetchOrderManagement(rootCommessaKey, articleHint, commessaFull) };
    } catch (err) {
        return { success: false, error: errorMessage(err), operationsManagement: emptyManagement() };
    }
}

/**
 * "Riallinea": rewrites the Business and NetPro order from the DiBa (WRITES to both databases).
 * Needs "modifica" on the page and the Riallinea function, given apart in Gruppi.
 */
export async function syncOrderFromDibaAction(params: { rootCommessaKey: string; articleFather?: string }): Promise<{ success: true } | Failure> {
    await authorize('edit', LINKS.workProgress);
    await authorize('edit', WORK_PROGRESS_FUNCTIONS.riallinea);
    try {
        return await syncOrderFromDiba(params.rootCommessaKey, params.articleFather);
    } catch (err) {
        console.error('Error in syncOrderFromDibaAction:', err);
        return { success: false, error: errorMessage(err) };
    }
}
