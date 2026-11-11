'use client';

import { useMemo, useState } from 'react';
import { ChangeLines } from '@/components/analytics/order-operations/ChangeLines';
import { MisalignedOrderActions, whyNotRealign } from '@/components/analytics/order-operations/MisalignedOrderActions';
import { MisalignedOrderMarks } from '@/components/analytics/order-operations/MisalignedOrderMarks';
import { NetproStatusBadge } from '@/components/analytics/order-operations/NetproStatusBadge';
import { SyncDialog } from '@/components/analytics/order-operations/SyncDialog';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { MissingValue } from '@/components/ui/TableCells';
import { ToggleChips, type ChipOption } from '@/components/ui/ToggleChips';
import { ViewLink } from '@/components/ui/ViewLink';
import type { ViewTarget } from '@/hooks/useAddress';
import { useCanRiallinea } from '@/hooks/useCanRiallinea';
import { useClientSort } from '@/hooks/useClientSort';
import { useOrderAddress } from '@/hooks/useOrderAddress';
import { EMPTY_VALUE } from '@/lib/format';
import { DIFFERENCE_KINDS, differenceLines } from '@/lib/orders/differences';
import type { SyncChangeGroupKey } from '@/lib/orders/syncPreview';
import type { MisalignedOrder, MisalignedOrders, OtherProductionOrder } from '@/lib/orders/types';
import type { RowSortColumns } from '@/lib/sort';
import { cn, toggleInSet } from '@/lib/utils';
import { APP_COPY, fmt } from '@/locales';

const t = APP_COPY.analytics.orderOperations;
const copy = t.misaligned;
const kindNames = t.syncPreview.groups;

/** What a chip keeps: the orders with a kind of difference, or those whose article has other production orders */
type Filter = SyncChangeGroupKey | 'duplicates';
const FILTERS: readonly Filter[] = [...DIFFERENCE_KINDS, 'duplicates'];
const isFilter = (text: string): text is Filter => FILTERS.some((filter) => filter === text);

const countOf = (order: MisalignedOrder, kind: SyncChangeGroupKey) => order.differences.find((difference) => difference.kind === kind)?.count ?? 0;
const hasFilter = (order: MisalignedOrder, filter: Filter) => (filter === 'duplicates' ? order.otherOrders.length > 0 : countOf(order, filter) > 0);
const otherOrderText = (order: OtherProductionOrder) =>
    fmt(copy.otherOrder, { business: order.business ?? EMPTY_VALUE, netpro: order.netpro ?? EMPTY_VALUE, state: order.state ?? EMPTY_VALUE });

// "2026/9502" sorts by year, then by number (numbers inside a text are compared as numbers)
const SORT_COLUMNS: RowSortColumns<MisalignedOrder> = {
    impegno: (order) => order.impegno,
    commessa: (order) => order.commessa,
    title: (order) => order.title,
    client: (order) => order.client,
    businessOrder: (order) => order.businessOrder,
    netproState: (order) => order.netproState,
    ...Object.fromEntries(DIFFERENCE_KINDS.map((kind) => [kind, (order: MisalignedOrder) => countOf(order, kind)])),
};
const byCommessa = (a: MisalignedOrder, b: MisalignedOrder) => b.commessa.localeCompare(a.commessa) || b.netproOrder.localeCompare(a.netproOrder);

interface MisalignedOrdersListProps {
    data: MisalignedOrders;
    /** An order is being opened */
    busy: boolean;
    /** The rows being read again or realigned (NetPro order ids) */
    busyOrders: ReadonlySet<string>;
    /** Kept in place but out of sight while an order is open, so the filters and the open rows are there on the way back */
    hidden: boolean;
    /** The link that opens an order (the first characters of its commessa) */
    linkOf: (rootCommessaKey: string) => ViewTarget;
    /** Reads a row again and gives it back (null: no longer open, undefined: the read failed) */
    onRefresh: (order: MisalignedOrder) => Promise<MisalignedOrder | null | undefined>;
    /** Realigns the order of a row (writes to Business and NetPro); true when it worked */
    onSync: (order: MisalignedOrder) => Promise<boolean>;
}

/**
 * "Ordini da riallineare": the open production orders that differ from their impegno cliente or their DiBa, one row per
 * order with the number of differences of each kind. A row is the link to its order (a click opens it, the middle
 * button in another tab); the chips keep the orders with a kind of difference and are in the address. The buttons at
 * the start of a row show the lines of the Riallinea preview under it, read it again and realign it (after the same
 * confirm window as on the order's page); the icons after them say what kind of row it is (MisalignedOrderMarks).
 */
export function MisalignedOrdersList({ data, busy, busyOrders, hidden, linkOf, onRefresh, onSync }: MisalignedOrdersListProps) {
    const canRiallinea = useCanRiallinea();
    const address = useOrderAddress();
    const { kinds } = address.values;
    const filters = useMemo<ReadonlySet<Filter>>(() => new Set(kinds.filter(isFilter)), [kinds]);
    const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
    /** The order whose realign waits for a yes in the confirm window */
    const [confirming, setConfirming] = useState<MisalignedOrder | null>(null);

    /** The confirm window lists what is in the databases now: the row is read again first */
    const startSync = async (order: MisalignedOrder) => {
        const fresh = await onRefresh(order);
        if (fresh && !whyNotRealign(fresh)) setConfirming(fresh);
    };

    const filtered = useMemo(
        () => (filters.size === 0 ? data.orders : data.orders.filter((order) => Array.from(filters).some((filter) => hasFilter(order, filter)))),
        [data.orders, filters]
    );
    const { sorted, sort, toggleSort } = useClientSort(filtered, SORT_COLUMNS, { column: 'impegno', direction: 'desc' }, byCommessa);

    const amount = (filter: Filter) => data.orders.filter((order) => hasFilter(order, filter)).length;
    const chips: ChipOption<Filter>[] = [
        ...DIFFERENCE_KINDS.map((kind) => ({ key: kind, label: kindNames[kind], count: amount(kind) })),
        { key: 'duplicates', label: copy.duplicatesChip, count: amount('duplicates'), tone: 'warning' },
    ];

    const columns: DataTableColumn<MisalignedOrder>[] = [
        {
            key: 'actions',
            header: '',
            sortable: false,
            compact: true,
            mobileLabel: copy.rowActions,
            cell: (order) => (
                <MisalignedOrderActions
                    order={order}
                    detailsShown={open.has(order.netproOrder)}
                    busy={busyOrders.has(order.netproOrder)}
                    canRiallinea={canRiallinea}
                    onToggleDetails={() => setOpen((previous) => toggleInSet(previous, order.netproOrder))}
                    onRefresh={() => onRefresh(order)}
                    onSync={() => startSync(order)}
                />
            ),
        },
        // Right after the buttons: what kind of row it is (blocked, double, several editions …), told by icons
        { key: 'marks', header: '', headerTitle: copy.columns.notes, sortable: false, compact: true, mobileLabel: copy.columns.notes, cell: (order) => <MisalignedOrderMarks order={order} /> },
        { key: 'impegno', header: copy.columns.impegno, compact: true, cell: (order) => (order.impegno ? <span className="font-mono text-fg-soft">{order.impegno}</span> : <MissingValue />) },
        // The row's link as a real one: it can be copied, and reached with the keyboard
        {
            key: 'commessa',
            header: copy.columns.commessa,
            compact: true,
            mobileHidden: true,
            cell: (order) => (
                <ViewLink to={linkOf(order.rootCommessaKey)} className="font-mono font-semibold text-primary hover:underline">
                    {order.commessa}
                </ViewLink>
            ),
        },
        // The title takes the width the other columns leave, and is cut there
        { key: 'title', header: copy.columns.title, compact: true, mobileHidden: true, className: 'w-full max-w-0 min-w-40', cell: (order) => <span className="block truncate font-medium text-fg" title={order.title}>{order.title || EMPTY_VALUE}</span> },
        { key: 'client', header: copy.columns.client, compact: true, mobileHidden: true, cell: (order) => <span className="block max-w-36 truncate text-fg-muted" title={order.client}>{order.client || EMPTY_VALUE}</span> },
        { key: 'businessOrder', header: copy.columns.businessOrder, compact: true, variant: 'number', cell: (order) => order.businessOrder ?? <MissingValue /> },
        { key: 'netproState', header: copy.columns.netproState, compact: true, align: 'center', cell: (order) => <span title={order.netproOrder}><NetproStatusBadge status={order.netproState} /></span> },
        ...DIFFERENCE_KINDS.map((kind): DataTableColumn<MisalignedOrder> => ({
            key: kind,
            header: kindNames[kind],
            compact: true,
            variant: 'number',
            cell: (order) => countOf(order, kind) || <MissingValue />,
        })),
    ];

    return (
        <div className={cn('flex-1 min-h-0 flex flex-col gap-3', hidden && 'hidden')}>
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 flex-shrink-0">
                <ToggleChips label={copy.filterLabel} options={chips} active={filters} onToggle={(filter) => address.set({ kinds: [...toggleInSet(filters, filter)] }, 'replace')} />
                <p className="text-sm text-fg-muted">
                    {fmt(copy.summary, { checked: data.checked, listed: data.orders.filter((order) => order.differences.length > 0 || order.error).length, duplicates: amount('duplicates') })}
                </p>
            </div>
            <DataTable
                columns={columns}
                rows={sorted}
                getRowKey={(order) => order.netproOrder}
                rowLink={(order) => linkOf(order.rootCommessaKey)}
                rowDetail={(order) =>
                    open.has(order.netproOrder) && (
                        <div className="space-y-2 pl-8 text-xs leading-relaxed">
                            {order.error && <p className="text-danger">{copy.failed}: {order.error}</p>}
                            {order.syncBlocks.map((block) => <p key={block} className="text-danger">{block}</p>)}
                            {order.syncKeeps.map((line) => <p key={line} className="text-warning-300">{line}</p>)}
                            {order.differences.map((difference) => (
                                <ChangeLines key={difference.kind} title={kindNames[difference.kind]} count={difference.count} lines={differenceLines(difference)} />
                            ))}
                            {order.otherOrders.length > 0 && <ChangeLines title={copy.otherOrders} count={order.otherOrders.length} lines={order.otherOrders.map(otherOrderText)} />}
                        </div>
                    )
                }
                sort={sort}
                onSort={toggleSort}
                loading={busy}
                emptyMessage={data.orders.length === 0 ? copy.allAligned : copy.noMatch}
                mobileTitle={(order) => (
                    <>
                        <ViewLink to={linkOf(order.rootCommessaKey)} className="font-mono font-semibold text-primary">
                            {order.commessa}
                        </ViewLink>
                        <span className="block font-medium text-fg">{order.title}</span>
                    </>
                )}
                dense
                fill
                // A row read again stays where it is: only another sort or other chips start from the top
                scrollResetKey={`${sort.column} ${sort.direction} ${Array.from(filters).join(' ')}`}
            />
            {confirming && (
                <SyncDialog
                    commessa={confirming.commessa}
                    article={confirming.article}
                    changes={confirming.differences.filter((difference) => difference.changes.length > 0).map((difference) => ({ key: difference.kind, changes: difference.changes }))}
                    kept={confirming.syncKeeps}
                    syncing={busyOrders.has(confirming.netproOrder)}
                    onConfirm={async () => {
                        if (await onSync(confirming)) setConfirming(null);
                    }}
                    onClose={() => setConfirming(null)}
                />
            )}
        </div>
    );
}
