'use client';

import { useMemo, useState } from 'react';
import { ListChecks, Search, Workflow } from 'lucide-react';
import { MisalignedOrdersList } from '@/components/analytics/order-operations/MisalignedOrdersList';
import { OrderHeader } from '@/components/analytics/order-operations/OrderHeader';
import { OrderMatches } from '@/components/analytics/order-operations/OrderMatches';
import { OrderWorkspace } from '@/components/analytics/order-operations/OrderWorkspace';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { ViewLink } from '@/components/ui/ViewLink';
import { useMisalignedOrders } from '@/hooks/useMisalignedOrders';
import { useOrderAddress } from '@/hooks/useOrderAddress';
import { useOrderSearch } from '@/hooks/useOrderSearch';
import { buildProductionFlow } from '@/lib/orders/flow';
import { cn } from '@/lib/utils';
import { APP_COPY } from '@/locales';

const t = APP_COPY.analytics.orderOperations;

/**
 * Work progress page: search an order by commessa number or description, then follow its production flow,
 * its materials and how it compares with the DiBa; or list the open orders to realign and open one from there.
 * What is on screen (the search, the list, the order and its tabs) is in the address: useOrderAddress.
 * Fills the screen; only the open panel scrolls.
 */
export function OrderOperationsReport() {
    const address = useOrderAddress();
    const { q, order: orderKey, misaligned: showList } = address.values;
    const { matches, order, loading, message, error, again } = useOrderSearch({ term: q, orderKey, onOnlyMatch: address.showOnly });
    // The open orders are compared when their list is on screen, not behind an order opened from a link
    const misaligned = useMisalignedOrders(showList && !orderKey);
    const flow = useMemo(() => buildProductionFlow(order?.operations ?? []), [order]);

    /** The text being typed; "Cerca" puts it in the address */
    const [term, setTerm] = useState(q);
    // Another search in the address (Back, a link) shows in the box; an address without one leaves what was typed
    const [shownSearch, setShownSearch] = useState(q);
    if (shownSearch !== q) {
        setShownSearch(q);
        if (q) setTerm(q);
    }

    const submit = () => {
        const text = term.trim();
        // The same search again, with its results on screen: read again
        if (text && text === q && !orderKey) again();
        else address.search(text);
    };

    // "Ordini da riallineare" takes the place of the search results; what was read stays while an order is open over it
    const list = showList ? misaligned.data : null;
    const toList = address.misalignedLink();
    // How many orders the list under the open order has (not known while it was not read): with several, a link goes back to it
    const under = showList ? misaligned.data?.orders.length : matches.length;
    // What went wrong last: comparing the open orders, or the search
    const failure = (showList ? misaligned.error : null) ?? error;
    const waiting = showList ? misaligned.loading : loading && matches.length === 0;

    return (
        <div className="flex-1 min-h-0 flex flex-col gap-3">
            <div className="flex items-center gap-3 flex-shrink-0">
                <div className="hidden md:flex items-center gap-2 flex-shrink-0">
                    <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary">
                        <Workflow size={18} />
                    </div>
                    <h1 className="text-lg font-bold text-fg-strong whitespace-nowrap">{t.pageTitle}</h1>
                </div>
                <form
                    className="flex-1 flex gap-2"
                    onSubmit={(event) => {
                        event.preventDefault();
                        submit();
                    }}
                >
                    <div className="flex-1">
                        <Input placeholder={t.searchPlaceholder} value={term} onChange={(e) => setTerm(e.target.value)} disabled={loading} />
                    </div>
                    <Button type="submit" disabled={loading}>
                        <Search className="w-4 h-4" />
                        {loading ? t.searching : t.search}
                    </Button>
                    {/* The open orders are compared only when asked for: the list then takes the place of the search
                        results. A click compares them again; the link opens the list in another tab too */}
                    <ViewLink
                        to={{
                            href: toList.href,
                            onOpen: () => {
                                toList.onOpen();
                                void misaligned.load();
                            },
                        }}
                        title={t.misaligned.button}
                        aria-disabled={misaligned.loading}
                        className={buttonClasses({ variant: 'secondary', className: cn(misaligned.loading && 'pointer-events-none opacity-50') })}
                    >
                        {misaligned.loading ? <Spinner size={16} /> : <ListChecks className="w-4 h-4" />}
                        <span className="hidden sm:inline">{misaligned.loading ? t.misaligned.loading : t.misaligned.button}</span>
                    </ViewLink>
                </form>
            </div>

            {order && (
                <>
                    <OrderHeader editions={order.editions} flow={flow} matchCount={under} backTo={under === undefined || under > 1 ? address.listLink() : undefined} />
                    <OrderWorkspace key={order.loadId} order={order} flow={flow} />
                </>
            )}
            {list && (
                <MisalignedOrdersList
                    data={list}
                    busy={loading}
                    busyOrders={misaligned.busy}
                    hidden={!!order}
                    linkOf={address.orderLink}
                    onRefresh={misaligned.refreshOrder}
                    onSync={misaligned.syncOrder}
                />
            )}
            {!order && !list && (
                <div className="flex-1 min-h-0 overflow-auto space-y-3">
                    {waiting ? (
                        <Card className="flex flex-col items-center gap-3 py-8 text-fg-subtle">
                            <Spinner size={28} />
                            <p className="text-sm">{showList ? t.misaligned.comparing : APP_COPY.common.loading}</p>
                        </Card>
                    ) : (
                        <>
                            {!showList && matches.length > 1 && <OrderMatches matches={matches} linkOf={address.orderLink} />}
                            {!showList && !failure && message && (
                                <Card className="text-center py-8 text-fg-subtle">
                                    <Search className="w-12 h-12 mx-auto mb-3 text-fg-secondary" />
                                    <p className="text-sm">{message}</p>
                                </Card>
                            )}
                            {failure && (
                                <Card className="text-center py-8 text-danger">
                                    <p className="text-sm">{failure}</p>
                                </Card>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
