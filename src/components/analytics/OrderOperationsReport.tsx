'use client';

import { useMemo } from 'react';
import { ListChecks, Search, Workflow } from 'lucide-react';
import { MisalignedOrdersList } from '@/components/analytics/order-operations/MisalignedOrdersList';
import { OrderHeader } from '@/components/analytics/order-operations/OrderHeader';
import { OrderMatches } from '@/components/analytics/order-operations/OrderMatches';
import { OrderWorkspace } from '@/components/analytics/order-operations/OrderWorkspace';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { useMisalignedOrders } from '@/hooks/useMisalignedOrders';
import { useOrderSearch } from '@/hooks/useOrderSearch';
import { buildProductionFlow } from '@/lib/orders/flow';
import { APP_COPY } from '@/locales';

const t = APP_COPY.analytics.orderOperations;

/**
 * Work progress page: search an order by commessa number or description, then follow its production flow,
 * its materials and how it compares with the DiBa; or list the open orders to realign and open one from there.
 * Fills the screen; only the open panel scrolls.
 */
export function OrderOperationsReport() {
    const { term, setTerm, matches, order, loading, message, error, search, select, back } = useOrderSearch();
    const misaligned = useMisalignedOrders();
    const flow = useMemo(() => buildProductionFlow(order?.operations ?? []), [order]);
    // What went wrong last: comparing the open orders, or the search
    const failure = misaligned.error ?? error;

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
                        misaligned.clear();
                        search();
                    }}
                >
                    <div className="flex-1">
                        <Input placeholder={t.searchPlaceholder} value={term} onChange={(e) => setTerm(e.target.value)} disabled={loading} />
                    </div>
                    <Button type="submit" disabled={loading}>
                        <Search className="w-4 h-4" />
                        {loading ? t.searching : t.search}
                    </Button>
                    {/* The open orders are compared only when asked for: the list then takes the place of the search results */}
                    <Button
                        type="button"
                        variant="secondary"
                        disabled={misaligned.loading}
                        title={t.misaligned.button}
                        onClick={() => {
                            back();
                            misaligned.load();
                        }}
                    >
                        {misaligned.loading ? <Spinner size={16} /> : <ListChecks className="w-4 h-4" />}
                        <span className="hidden sm:inline">{misaligned.loading ? t.misaligned.loading : t.misaligned.button}</span>
                    </Button>
                </form>
            </div>

            {order && (
                <>
                    <OrderHeader editions={order.editions} flow={flow} matchCount={misaligned.data ? misaligned.data.orders.length : matches.length} onBack={back} />
                    <OrderWorkspace key={order.loadId} order={order} flow={flow} />
                </>
            )}
            {misaligned.data && (
                <MisalignedOrdersList
                    data={misaligned.data}
                    busy={loading}
                    busyOrders={misaligned.busy}
                    hidden={!!order}
                    onSelect={select}
                    onRefresh={misaligned.refreshOrder}
                    onSync={misaligned.syncOrder}
                />
            )}
            {!order && !misaligned.data && (
                <div className="flex-1 min-h-0 overflow-auto space-y-3">
                    {misaligned.loading ? (
                        <Card className="flex flex-col items-center gap-3 py-8 text-fg-subtle">
                            <Spinner size={28} />
                            <p className="text-sm">{t.misaligned.comparing}</p>
                        </Card>
                    ) : (
                        <>
                            {!misaligned.error && matches.length > 1 && <OrderMatches matches={matches} onSelect={select} />}
                            {!failure && message && (
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
