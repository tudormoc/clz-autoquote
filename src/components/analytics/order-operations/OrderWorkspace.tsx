'use client';

import { useState } from 'react';
import { AlertTriangle, Boxes, Check, Layers, Workflow } from 'lucide-react';
import { OrderManagementPanel } from '@/components/analytics/order-operations/OrderManagementPanel';
import { OrderMaterialsPanel } from '@/components/analytics/order-operations/OrderMaterialsPanel';
import { ProductionFlowPanel } from '@/components/analytics/order-operations/ProductionFlowPanel';
import { TabBar, type TabItem } from '@/components/ui/TabBar';
import type { OrderDetails } from '@/hooks/useOrderSearch';
import type { buildProductionFlow } from '@/lib/orderFlow';
import { cn } from '@/lib/utils';
import { APP_COPY } from '@/locales';

const t = APP_COPY.analytics.orderOperations;

type WorkspaceTab = 'flow' | 'materials' | 'management';

interface OrderWorkspaceProps {
    order: OrderDetails;
    flow: ReturnType<typeof buildProductionFlow>;
}

/** The open order: tabs for the production flow, the materials and the DiBa comparison. */
export function OrderWorkspace({ order, flow }: OrderWorkspaceProps) {
    const [tab, setTab] = useState<WorkspaceTab>('flow');
    // DiBa alignment as reported by the comparison panel (it stays right after a refresh or a realign there)
    const [diba, setDiba] = useState<{ hasDiscrepancies: boolean; count: number } | null>(null);

    const hasDiscrepancies = diba ? diba.hasDiscrepancies : !!order.management.has_discrepancies;
    const discrepancyCount = diba ? diba.count : order.management.discrepancy_count || 0;
    const rootCommessaKey = order.editions[0]?.commessa_full?.slice(0, 7) ?? '';

    const tabs: TabItem<WorkspaceTab>[] = [
        { id: 'flow', label: t.operationsTab, icon: <Workflow className="w-4 h-4 text-info-400" />, count: order.operations.length },
        { id: 'materials', label: t.materialsTab, icon: <Boxes className="w-4 h-4 text-warning-400" />, count: order.materials.length },
        {
            id: 'management',
            label: t.operationsManagementTab,
            icon: <Layers className="w-4 h-4 text-highlight-400" />,
            badge: hasDiscrepancies ? (
                <span className="inline-flex items-center gap-1 text-3xs px-1.5 rounded-full bg-warning-500/20 text-warning-300 border border-warning-500/30">
                    <AlertTriangle className="w-3 h-3" />{discrepancyCount}
                </span>
            ) : (
                <span className="inline-flex items-center gap-0.5 text-3xs px-1.5 rounded-full bg-success-500/15 text-success-400 border border-success-500/30">
                    <Check className="w-3 h-3" />{t.dibaShort}
                </span>
            ),
        },
    ];

    // Panels stay mounted (hidden) so what was opened in them survives a tab switch
    const panel = (id: WorkspaceTab) => cn('absolute inset-0 overflow-auto p-3', tab !== id && 'hidden');

    return (
        <div className="flex-1 min-h-0 flex flex-col rounded-xl border border-border/80 bg-card/40 overflow-hidden">
            <TabBar tabs={tabs} active={tab} onChange={setTab} className="flex-shrink-0 px-2 pt-2 border-b border-border/80" />
            <div className="flex-1 min-h-0 relative">
                <div className={panel('flow')}>
                    <ProductionFlowPanel flow={flow} />
                </div>
                <div className={panel('materials')}>
                    <OrderMaterialsPanel materials={order.materials} />
                </div>
                <div className={panel('management')}>
                    <OrderManagementPanel
                        initial={order.management}
                        rootCommessaKey={rootCommessaKey}
                        editions={order.editions}
                        onStatusChange={(hasDiscrepancies, count) => setDiba({ hasDiscrepancies, count })}
                    />
                </div>
            </div>
        </div>
    );
}
