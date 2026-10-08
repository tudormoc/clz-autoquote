import { OperationNode } from '@/components/analytics/order-operations/OperationNode';
import type { FlowOperation } from '@/lib/orders/flow';
import { buildProductionFlow } from '@/lib/orders/flow';
import { cn } from '@/lib/utils';
import { APP_COPY } from '@/locales';

const t = APP_COPY.analytics.orderOperations;

const LEGEND = [
    { label: t.statusCompleted, dot: 'bg-success-600' },
    { label: t.statusActive, dot: 'bg-info animate-pulse' },
    { label: t.statusPaused, dot: 'bg-warning' },
    { label: t.statusScheduled, dot: 'bg-muted-strong' },
];

interface FlowColumnProps {
    title: string;
    operations: FlowOperation[];
    accent: string;
    emptyText?: string;
    /** Number the steps that have not started */
    numbered?: boolean;
}

/** One column of the flow (block, cover, assembly …) with its done / total count. */
function FlowColumn({ title, operations, accent, emptyText, numbered }: FlowColumnProps) {
    const done = operations.filter((op) => op.status === 'COM').length;
    return (
        <div className="flex flex-col min-h-0 rounded-xl border border-border/70 bg-card/30">
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/70">
                <h3 className={cn('text-xs font-bold flex items-center gap-1.5', accent)}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    {title}
                </h3>
                <span className="text-3xs font-mono text-fg-muted">{done}/{operations.length}</span>
            </div>
            <div className="p-2 space-y-1.5">
                {operations.length > 0 ? (
                    operations.map((operation, index) => <OperationNode key={index} operation={operation} index={numbered ? index : undefined} />)
                ) : (
                    <div className="py-4 text-center italic text-fg-subtle text-xs">{emptyText || '-'}</div>
                )}
            </div>
        </div>
    );
}

/** The production flow of the order: block and cover side by side, then assembly, finishing and the rest. */
export function ProductionFlowPanel({ flow }: { flow: ReturnType<typeof buildProductionFlow> }) {
    return (
        <>
            <div className="flex flex-wrap items-center justify-end gap-4 mb-2 text-2xs text-fg-subtle">
                {LEGEND.map(({ label, dot }) => (
                    <span key={label} className="flex items-center gap-1.5">
                        <span className={cn('w-2 h-2 rounded-full', dot)} />
                        {label}
                    </span>
                ))}
            </div>
            <div className="grid gap-3 items-start grid-cols-[repeat(auto-fit,minmax(230px,1fr))]">
                <FlowColumn title={t.blockProduction} operations={flow.blockOps} accent="text-info-400" emptyText={t.noBlockOps} numbered />
                <FlowColumn title={t.coverProduction} operations={flow.coverOps} accent="text-primary" emptyText={t.noCoverOps} numbered />
                {flow.assemblyOps.length > 0 && <FlowColumn title={t.assemblyBinding} operations={flow.assemblyOps} accent="text-fg-secondary" numbered />}
                {flow.finishingOps.length > 0 && <FlowColumn title={t.finishingDelivery} operations={flow.finishingOps} accent="text-fg-secondary" />}
                {flow.otherOps.length > 0 && <FlowColumn title={t.otherOperations} operations={flow.otherOps} accent="text-fg-muted" />}
            </div>
        </>
    );
}
