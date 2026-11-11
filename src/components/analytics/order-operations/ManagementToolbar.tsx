import { AlertTriangle, Check, Pin, RefreshCw } from 'lucide-react';
import { AlignIcon } from '@/components/ui/AlignIcon';
import { Button } from '@/components/ui/Button';
import { choiceClasses } from '@/components/ui/ChoiceButton';
import { Spinner } from '@/components/ui/Spinner';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ViewLink } from '@/components/ui/ViewLink';
import type { ViewTarget } from '@/hooks/useAddress';
import { useCanRiallinea } from '@/hooks/useCanRiallinea';
import { keepsSomething, syncBlockText, syncKeepLines, syncKeepNames } from '@/lib/orders/syncBlocks';
import { cn } from '@/lib/utils';
import { APP_COPY, fmt } from '@/locales';
import type { OrderEdition, OrderOperationsManagementData } from '@/types';

const t = APP_COPY.analytics.orderOperations;

interface ManagementToolbarProps {
    data: OrderOperationsManagementData;
    editions: OrderEdition[];
    refreshing: boolean;
    syncing: boolean;
    /** The link that compares another edition (its commessa) */
    editionLink: (commessaFull: string) => ViewTarget;
    onRefresh: () => void;
    onSync: () => void;
}

/**
 * Edition picker, the ids of the orders, what stays on the order although the DiBa no longer has it (already used),
 * whether the order is aligned to the DiBa, and the realign and reload buttons.
 */
export function ManagementToolbar({ data, editions, refreshing, syncing, editionLink, onRefresh, onSync }: ManagementToolbarProps) {
    const canSync = useCanRiallinea();
    const multiEdition = editions.length > 1;
    const hasDiscrepancies = data.has_discrepancies ?? false;
    const blocks = data.sync_blocks ?? [];
    const blocked = blocks.length > 0;

    return (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {multiEdition && (
                <div className="flex items-center gap-1">
                    <span className="text-3xs text-fg-subtle font-semibold mr-1">{t.editions}</span>
                    {editions.map((edition, index) => {
                        const selected = data.commessa_full === edition.commessa_full;
                        return (
                            <ViewLink
                                key={edition.commessa_full}
                                to={editionLink(edition.commessa_full)}
                                aria-current={selected ? 'page' : undefined}
                                aria-disabled={refreshing}
                                title={edition.order_description}
                                className={choiceClasses({ selected, size: 'sm', className: cn('px-2 font-mono', refreshing && 'pointer-events-none opacity-50') })}
                            >
                                {index + 1} · {edition.commessa_full}
                            </ViewLink>
                        );
                    })}
                </div>
            )}

            <div className="flex items-center gap-4 text-xs">
                <div>
                    <span className="text-3xs text-fg-subtle font-semibold">{t.dibaArticleFather} </span>
                    <span className="font-mono font-bold text-fg">{data.article_father || '-'}</span>
                </div>
                <div>
                    <span className="text-3xs text-fg-subtle font-semibold">{t.netpro} </span>
                    <span className="font-mono font-bold text-fg">{data.ordine_netpro || editions[0]?.ordine || '-'}</span>
                    <span className="text-fg-subtle"> · {fmt(t.businessOrderNum, { num: data.order_bus_numord || '-' })}</span>
                </div>
            </div>

            <div className="ml-auto flex items-center gap-2">
                {/* A phase already worked on or a material already withdrawn that left the DiBa: Riallinea leaves it */}
                {keepsSomething(data.sync_keeps) && (
                    <StatusBadge tone="info" size="md" title={syncKeepLines(data.sync_keeps).join('\n')}>
                        <Pin className="w-3.5 h-3.5" />
                        {fmt(t.syncKeptBadge, { kept: syncKeepNames(data.sync_keeps) })}
                    </StatusBadge>
                )}
                {hasDiscrepancies ? (
                    <StatusBadge tone="warning" size="md">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {fmt(t.dibaDiscrepanciesDetected, { count: data.discrepancy_count ?? 0 })}
                    </StatusBadge>
                ) : (
                    <StatusBadge tone="success" size="md">
                        <Check className="w-3.5 h-3.5" />
                        {t.dibaAligned}
                    </StatusBadge>
                )}

                {/* Realigns the edition shown: each edition is an article of its own, with its own orders. Not when it
                    would take every phase away (an article without DiBa phases): the badge says so */}
                {hasDiscrepancies && canSync && blocked && (
                    <StatusBadge tone="danger" size="md" title={syncBlockText(blocks)}>
                        {t.syncBlocked}
                    </StatusBadge>
                )}
                {hasDiscrepancies && canSync && (
                    <Button variant="warning" size="sm" onClick={onSync} disabled={syncing || refreshing || blocked} title={blocked ? syncBlockText(blocks) : t.syncButton}>
                        <AlignIcon className="w-3.5 h-3.5" />
                        {syncing ? t.syncing : t.syncButton}
                    </Button>
                )}

                <Button variant="secondary" size="sm" onClick={onRefresh} disabled={refreshing} title={t.refreshData} className="w-8 px-0">
                    {refreshing ? <Spinner size={16} className="text-highlight-400" /> : <RefreshCw size={16} />}
                </Button>
            </div>
        </div>
    );
}
