import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { AlignIcon } from '@/components/ui/AlignIcon';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { syncBlockText } from '@/lib/orders/syncBlocks';
import type { MisalignedOrder } from '@/lib/orders/types';
import { cn } from '@/lib/utils';
import { APP_COPY, fmt } from '@/locales';

const t = APP_COPY.analytics.orderOperations;
const copy = t.misaligned;

/** Whether a realign of the order would write something */
const hasChanges = (order: MisalignedOrder) => order.differences.some((difference) => difference.changes.length > 0);

/** "Business LCDQ9650, NetPro LCDT9650": the two articles of an order that names another one in NetPro */
export const articleDiffersText = (order: MisalignedOrder) => fmt(copy.articleDiffersTitle, { business: order.article, netpro: order.netproArticle ?? '' });

/**
 * Why the order cannot be realigned from the list, or null when it can: the article has to have one production order
 * only and the same name in both programs, the realign must not be one that is refused (syncBlocks.ts), and there has
 * to be something to write. An edition is realigned on its own.
 */
export function whyNotRealign(order: MisalignedOrder): string | null {
    if (!order.canRealign) return copy.syncNeedsSingleOrder;
    if (order.netproArticle) return articleDiffersText(order);
    if (order.syncBlocks.length > 0) return syncBlockText(order.syncBlocks);
    if (order.error || !hasChanges(order)) return t.syncPreview.none;
    return null;
}

interface MisalignedOrderActionsProps {
    order: MisalignedOrder;
    /** The lines of what differs are shown under the row */
    detailsShown: boolean;
    /** The row is being read again or realigned */
    busy: boolean;
    /** The person may realign orders (the button is not there otherwise) */
    canRiallinea: boolean;
    onToggleDetails: () => void;
    onRefresh: () => void;
    onSync: () => void;
}

/** A small button of a row: only its icon, no box until the pointer is on it */
const ICON_BUTTON = 'h-7 w-7 px-0 text-fg-muted hover:text-primary';

/**
 * The three small buttons at the start of a row of "Ordini da riallineare": show what differs, read the order again,
 * realign it from its DiBa (the one that writes, in the colour of every write to the production databases).
 */
export function MisalignedOrderActions({ order, detailsShown, busy, canRiallinea, onToggleDetails, onRefresh, onSync }: MisalignedOrderActionsProps) {
    const refused = whyNotRealign(order);
    const detailsLabel = detailsShown ? copy.hideDetails : copy.showDetails;
    /** The row itself opens the order: a click on a button stays on the button */
    const press = (action: () => void) => (event: React.MouseEvent) => {
        event.stopPropagation();
        action();
    };

    return (
        <span className="flex items-center gap-0.5">
            <Button variant="ghost" size="sm" className={ICON_BUTTON} title={detailsLabel} aria-label={detailsLabel} aria-expanded={detailsShown} onClick={press(onToggleDetails)}>
                {detailsShown ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </Button>
            <Button variant="ghost" size="sm" className={ICON_BUTTON} title={copy.refreshRow} aria-label={copy.refreshRow} disabled={busy} onClick={press(onRefresh)}>
                {busy ? <Spinner size={15} /> : <RefreshCw size={15} />}
            </Button>
            {canRiallinea && (
                <Button
                    variant="ghost"
                    size="sm"
                    className={cn(ICON_BUTTON, !refused && 'text-warning-400 hover:text-warning-300 hover:bg-warning-500/15')}
                    title={refused ?? copy.syncRow}
                    aria-label={copy.syncRow}
                    disabled={busy || !!refused}
                    onClick={press(onSync)}
                >
                    <AlignIcon size={18} />
                </Button>
            )}
        </span>
    );
}
