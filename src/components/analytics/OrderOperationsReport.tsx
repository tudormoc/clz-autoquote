'use client';

import { useMemo } from 'react';
import { Search, Workflow } from 'lucide-react';
import { OrderHeader } from '@/components/analytics/order-operations/OrderHeader';
import { OrderMatches } from '@/components/analytics/order-operations/OrderMatches';
import { OrderWorkspace } from '@/components/analytics/order-operations/OrderWorkspace';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useOrderSearch } from '@/hooks/useOrderSearch';
import { buildProductionFlow } from '@/lib/orderFlow';
import { APP_COPY } from '@/locales';

const t = APP_COPY.analytics.orderOperations;

/**
 * Work progress page: search an order by commessa number or description, then follow its production flow,
 * its materials and how it compares with the DiBa. Fills the screen; only the open panel scrolls.
 */
export function OrderOperationsReport() {
    const { term, setTerm, matches, order, loading, message, error, search, select, back } = useOrderSearch();
    const flow = useMemo(() => buildProductionFlow(order?.operations ?? []), [order]);

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
                </form>
            </div>

            {order ? (
                <>
                    <OrderHeader editions={order.editions} flow={flow} matchCount={matches.length} onBack={back} />
                    <OrderWorkspace key={order.loadId} order={order} flow={flow} />
                </>
            ) : (
                <div className="flex-1 min-h-0 overflow-auto space-y-3">
                    {matches.length > 1 && <OrderMatches matches={matches} onSelect={select} />}
                    {message && !error && (
                        <Card className="text-center py-8 text-fg-subtle">
                            <Search className="w-12 h-12 mx-auto mb-3 text-fg-secondary" />
                            <p className="text-sm">{message}</p>
                        </Card>
                    )}
                    {error && (
                        <Card className="text-center py-8 text-danger">
                            <p className="text-sm">{error}</p>
                        </Card>
                    )}
                </div>
            )}
        </div>
    );
}
