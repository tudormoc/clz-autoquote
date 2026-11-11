'use server'

/**
 * Server actions of the work progress page. The queries are in src/lib/orders/ (details, comparison, realign).
 */
import { fetchOrderDetails, findMasterOrders } from '@/lib/orders/details';
import { emptyManagement, fetchOrderManagement } from '@/lib/orders/management';
import { findMisalignedOrder, findMisalignedOrders } from '@/lib/orders/misaligned';
import type { RowChange } from '@/lib/orders/snapshot';
import { syncOrderFromDiba, type SyncOrderRef } from '@/lib/orders/sync';
import { keepsSomething, syncKeepLines, syncKeepNames } from '@/lib/orders/syncBlocks';
import type { MasterOrderMatch, MisalignedOrder, MisalignedOrders, OrderDetailsData } from '@/lib/orders/types';
import { logEvent, personOf } from '@/lib/log/log';
import { errorMessage } from '@/lib/utils';
import { APP_COPY, fmt } from '@/locales';
import type { OrderOperationsManagementData } from '@/types';
import { authorize } from '@/lib/auth/access';
import { LINKS, WORK_PROGRESS_FUNCTIONS } from '@/config/navigation';

type Failure = { success: false; error: string };

const log = APP_COPY.log.entries;

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

/** "Ordini da riallineare": the open orders that differ from their impegno cliente or their DiBa, and what differs (read only) */
export async function getMisalignedOrdersAction(): Promise<({ success: true } & MisalignedOrders) | Failure> {
    await authorize('view', LINKS.workProgress);
    try {
        return { success: true, ...(await findMisalignedOrders()) };
    } catch (err) {
        console.error('Error in getMisalignedOrdersAction:', err);
        return { success: false, error: errorMessage(err) };
    }
}

/** One row of "Ordini da riallineare" compared again (read only); `order` is null when the production order is no longer open */
export async function refreshMisalignedOrderAction(netproOrder: string): Promise<{ success: true; order: MisalignedOrder | null } | Failure> {
    await authorize('view', LINKS.workProgress);
    try {
        return { success: true, order: await findMisalignedOrder(netproOrder) };
    } catch (err) {
        console.error('Error in refreshMisalignedOrderAction:', err);
        return { success: false, error: errorMessage(err) };
    }
}

/**
 * "Riallinea": rewrites the Business and NetPro order of one edition from its impegno and its DiBa (WRITES to both
 * databases; the other editions of the commessa are not touched).
 * Needs "modifica" on the page and the Riallinea function, given apart in Gruppi. Every run is written in the log
 * (Registro) with the rows it changed, also when it is refused or fails. Gives back, one sentence each, what was left
 * on the order because it was already used.
 */
export async function syncOrderFromDibaAction(order: SyncOrderRef): Promise<{ success: true; kept: string[] } | Failure> {
    const access = await authorize('edit', LINKS.workProgress);
    await authorize('edit', WORK_PROGRESS_FUNCTIONS.riallinea);
    const who = personOf(access);
    // What comes from the browser is taken as text, whatever it is
    const commessa = String(order?.commessa ?? '').trim();
    const netproOrder = order?.netproOrder ? String(order.netproOrder).trim() : undefined;
    const entry = { page: LINKS.workProgress, action: 'riallinea', entityKind: 'order' };
    const failed = (outcome: 'refused' | 'error', error: string) =>
        logEvent(who, { ...entry, entityId: commessa, summary: fmt(log.riallineaFailed, { commessa }), outcome, error });
    try {
        const result = await syncOrderFromDiba({ commessa, netproOrder });
        if (!result.success) {
            await failed('refused', result.error);
            return result;
        }
        const count = (change: RowChange['change']) => result.changes?.filter((row) => row.change === change).length ?? 0;
        const summary = fmt(log.riallinea, { commessa: result.commessa, order: result.numord, changed: count('changed'), added: count('added'), removed: count('removed') });
        // What was left on the order because it was already used (a worked phase, a withdrawn material) is told too
        const somethingKept = keepsSomething(result.kept);
        await logEvent(who, {
            ...entry,
            entityId: result.commessa,
            summary: somethingKept ? fmt(log.riallineaKept, { summary, kept: syncKeepNames(result.kept) }) : summary,
            details: { order: result.numord, netpro: result.netOrdine, ...(somethingKept ? { kept: result.kept } : {}), rows: result.changes },
        });
        return { success: true, kept: syncKeepLines(result.kept) };
    } catch (err) {
        console.error('Error in syncOrderFromDibaAction:', err);
        await failed('error', errorMessage(err));
        return { success: false, error: errorMessage(err) };
    }
}
