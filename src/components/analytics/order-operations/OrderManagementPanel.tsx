'use client';

import { useMemo, useState } from 'react';
import { ArrowLeftRight, Boxes, Cpu, Hash, Package, Tag } from 'lucide-react';
import { DibaOperationsTable } from '@/components/analytics/order-operations/DibaOperationsTable';
import { ManagementToolbar } from '@/components/analytics/order-operations/ManagementToolbar';
import { MaterialsComparison } from '@/components/analytics/order-operations/MaterialsComparison';
import { OperationsComparison } from '@/components/analytics/order-operations/OperationsComparison';
import { ProductionOperationsTable } from '@/components/analytics/order-operations/ProductionOperationsTable';
import { DocumentFactsComparison } from '@/components/analytics/order-operations/DocumentFactsComparison';
import { SyncDialog } from '@/components/analytics/order-operations/SyncDialog';
import { LoadState } from '@/components/ui/LoadState';
import { TabBar, type TabItem } from '@/components/ui/TabBar';
import { useOrderAddress, type ManagementTab } from '@/hooks/useOrderAddress';
import { useOrderManagement } from '@/hooks/useOrderManagement';
import { ARTICLE_RULES, titleText } from '@/lib/orders/article';
import { compareOrder } from '@/lib/orders/differences';
import { QUANTITY_RULES, quantityText } from '@/lib/orders/quantities';
import { syncKeepLines } from '@/lib/orders/syncBlocks';
import { previewSync } from '@/lib/orders/syncPreview';
import { APP_COPY, fmt } from '@/locales';
import type { OrderEdition, OrderOperationsManagementData } from '@/types';

const t = APP_COPY.analytics.orderOperations;

interface OrderManagementPanelProps {
    /** What was loaded with the order; the panel reloads it by itself afterwards */
    initial: OrderOperationsManagementData;
    rootCommessaKey: string;
    editions: OrderEdition[];
    /** Reports whether the order is aligned to the DiBa, or that the comparison could not be read (shown on the tab label) */
    onStatusChange: (hasDiscrepancies: boolean, count: number, notRead: boolean) => void;
}

/**
 * Compares an order with its DiBa (Distinta Base, the truth): phases and materials of the Business order and the NetPro
 * order side by side, the quantity in every place, the DiBa and the production order lists, and the realign of the
 * order from the DiBa. The open tab and the edition compared are in the address.
 */
export function OrderManagementPanel({ initial, rootCommessaKey, editions, onStatusChange }: OrderManagementPanelProps) {
    const address = useOrderAddress();
    const { view: tab, edition } = address.values;
    // The edition compared: the one the address names when the order has it, or the first (which the address leaves out)
    const first = editions[0]?.commessa_full ?? '';
    const wanted = editions.some((each) => each.commessa_full === edition) ? edition : first;
    const { data, refreshing, syncing, refresh, sync } = useOrderManagement(initial, rootCommessaKey, wanted, onStatusChange);
    const [confirmingSync, setConfirmingSync] = useState(false);

    const dibaOperations = data.diba_operations;
    const orderOperations = data.order_operations;

    // Same comparisons as the server uses for the discrepancy count
    const comparisons = useMemo(() => compareOrder(data), [data]);
    const { phases, materials } = comparisons;
    // What Riallinea would change now, listed in its confirm window
    const changes = useMemo(() => previewSync(comparisons), [comparisons]);

    const tabs: TabItem<ManagementTab>[] = [
        { id: 'comparison', label: t.comparisonTab, icon: <ArrowLeftRight className="w-3.5 h-3.5 text-primary" />, count: phases.length },
        { id: 'materials', label: t.dibaMaterialsTab, icon: <Package className="w-3.5 h-3.5 text-success-400" />, count: materials.length },
        { id: 'quantity', label: t.quantityTab, icon: <Hash className="w-3.5 h-3.5 text-warning-300" />, count: data.quantities?.rows.length ?? 0 },
        { id: 'article', label: t.articleTab, icon: <Tag className="w-3.5 h-3.5 text-primary" />, count: data.article?.rows.length ?? 0 },
        { id: 'diba', label: t.dibaTab, icon: <Boxes className="w-3.5 h-3.5 text-highlight-400" />, count: dibaOperations.length },
        { id: 'order', label: t.prodOrderOpsTab, icon: <Cpu className="w-3.5 h-3.5 text-info-400" />, count: orderOperations.length },
    ];

    return (
        <div className="space-y-3">
            <ManagementToolbar
                data={data}
                editions={editions}
                refreshing={refreshing}
                syncing={syncing}
                editionLink={(commessaFull) => address.link({ edition: commessaFull === first ? '' : commessaFull })}
                onRefresh={refresh}
                onSync={() => setConfirmingSync(true)}
            />

            <TabBar tabs={tabs} active={tab} linkOf={(id) => address.link({ view: id })} className="border-b border-border" />

            {/* Not read: the empty tables below would look like an order with nothing in it */}
            {data.load_error && <LoadState loading={false} error={fmt(t.dibaNotReadHint, { error: data.load_error })} />}

            {tab === 'comparison' && <OperationsComparison rows={phases} businessOrderNumber={data.order_bus_numord} />}
            {tab === 'materials' && <MaterialsComparison rows={materials} />}
            {tab === 'quantity' && (
                <DocumentFactsComparison facts={data.quantities} rules={QUANTITY_RULES} names={t.quantityNames} factColumn={t.quantityColumn} format={quantityText} mono businessOrderNumber={data.order_bus_numord} />
            )}
            {tab === 'article' && (
                <DocumentFactsComparison facts={data.article} rules={ARTICLE_RULES} names={t.articleNames} factColumn={t.articleColumn} format={titleText} businessOrderNumber={data.order_bus_numord} />
            )}
            {tab === 'diba' && <DibaOperationsTable rows={dibaOperations} />}
            {tab === 'order' && <ProductionOperationsTable rows={orderOperations} />}

            {confirmingSync && (
                <SyncDialog
                    commessa={data.commessa_full ?? rootCommessaKey}
                    article={data.article_father}
                    changes={changes}
                    kept={syncKeepLines(data.sync_keeps)}
                    syncing={syncing}
                    onConfirm={async () => {
                        if (await sync()) setConfirmingSync(false);
                    }}
                    onClose={() => setConfirmingSync(false)}
                />
            )}
        </div>
    );
}
