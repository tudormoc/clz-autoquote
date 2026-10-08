'use client';

import { useMemo, useState } from 'react';
import { ArrowLeftRight, Boxes, Cpu, Package } from 'lucide-react';
import { DibaOperationsTable } from '@/components/analytics/order-operations/DibaOperationsTable';
import { ManagementToolbar } from '@/components/analytics/order-operations/ManagementToolbar';
import { MaterialsComparison } from '@/components/analytics/order-operations/MaterialsComparison';
import { OperationsComparison } from '@/components/analytics/order-operations/OperationsComparison';
import { ProductionOperationsTable } from '@/components/analytics/order-operations/ProductionOperationsTable';
import { SyncDialog } from '@/components/analytics/order-operations/SyncDialog';
import { TabBar, type TabItem } from '@/components/ui/TabBar';
import { APP_CONFIG } from '@/config/constants';
import { useOrderManagement } from '@/hooks/useOrderManagement';
import { compareMaterials, compareOperations } from '@/lib/orders/compare';
import { APP_COPY } from '@/locales';
import type { OrderEdition, OrderOperationsManagementData } from '@/types';

const t = APP_COPY.analytics.orderOperations;

type ManagementTab = 'comparison' | 'materials' | 'diba' | 'order';

interface OrderManagementPanelProps {
    /** What was loaded with the order; the panel reloads it by itself afterwards */
    initial: OrderOperationsManagementData;
    rootCommessaKey: string;
    editions: OrderEdition[];
    /** Reports whether the order is aligned to the DiBa (shown on the tab label) */
    onStatusChange: (hasDiscrepancies: boolean, count: number) => void;
}

/**
 * Compares an order with its DiBa (Distinta Base, the truth): phases and materials of the Business order and the NetPro
 * order side by side, the DiBa and the production order lists, and the realign of the order from the DiBa.
 */
export function OrderManagementPanel({ initial, rootCommessaKey, editions, onStatusChange }: OrderManagementPanelProps) {
    const { data, refreshing, syncing, refresh, selectEdition, sync } = useOrderManagement(initial, rootCommessaKey, onStatusChange);
    const [tab, setTab] = useState<ManagementTab>('comparison');
    const [confirmingSync, setConfirmingSync] = useState(false);

    const dibaOperations = data.diba_operations;
    const orderOperations = data.order_operations;
    const quantity = data.order_father_quant || APP_CONFIG.ORDERS.DEFAULT_QUANTITY;

    // Same comparison as the server uses for the discrepancy count
    const phases = useMemo(
        () => compareOperations(dibaOperations, data.business_operations ?? [], orderOperations),
        [dibaOperations, data.business_operations, orderOperations]
    );
    const materials = useMemo(
        () => compareMaterials(data.diba_materials ?? [], data.order_materials ?? [], data.netpro_materials ?? [], quantity),
        [data.diba_materials, data.order_materials, data.netpro_materials, quantity]
    );

    const tabs: TabItem<ManagementTab>[] = [
        { id: 'comparison', label: t.comparisonTab, icon: <ArrowLeftRight className="w-3.5 h-3.5 text-primary" />, count: phases.length },
        { id: 'materials', label: t.dibaMaterialsTab, icon: <Package className="w-3.5 h-3.5 text-success-400" />, count: materials.length },
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
                onSelectEdition={selectEdition}
                onRefresh={refresh}
                onSync={() => setConfirmingSync(true)}
            />

            <TabBar tabs={tabs} active={tab} onChange={setTab} className="border-b border-border" />

            {tab === 'comparison' && <OperationsComparison rows={phases} businessOrderNumber={data.order_bus_numord} />}
            {tab === 'materials' && <MaterialsComparison rows={materials} />}
            {tab === 'diba' && <DibaOperationsTable rows={dibaOperations} />}
            {tab === 'order' && <ProductionOperationsTable rows={orderOperations} />}

            {confirmingSync && (
                <SyncDialog
                    commessa={rootCommessaKey}
                    article={data.article_father}
                    businessOrderNumber={data.order_bus_numord}
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
