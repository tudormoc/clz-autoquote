import { CheckCircle, FileText, Pause, Play } from 'lucide-react';
import type { FlowOperation, FlowStatus } from '@/lib/orders/flow';
import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<FlowStatus, { box: string; icon: string }> = {
    COM: { box: 'bg-success-600/10 border-success-600/50 text-success-500', icon: 'bg-success-600/20 text-success-500' },
    EXE: { box: 'bg-info/10 border-info/50 text-info-400 ring-1 ring-info/30', icon: 'bg-info/20 text-info-400 animate-pulse motion-reduce:animate-none' },
    SUS: { box: 'bg-warning/10 border-warning/50 text-warning-300', icon: 'bg-warning/20 text-warning-300' },
    PENDING: { box: 'bg-card border-border text-fg-subtle', icon: 'bg-muted/60 text-fg-subtle' },
};

const NAME_TONE: Partial<Record<FlowStatus, string>> = { EXE: 'text-info-400', COM: 'text-success-500/90' };

interface OperationNodeProps {
    operation: FlowOperation;
    /** Position in the column; shown inside a step that has not started */
    index?: number;
}

/** One step of the production flow: status icon, operation, machine and the DiBa note when there is one. */
export function OperationNode({ operation, index }: OperationNodeProps) {
    const { status } = operation;
    const style = STATUS_STYLES[status];

    return (
        <div className={cn('relative px-2.5 py-1.5 rounded-lg border transition-colors', style.box, status !== 'EXE' && 'hover:border-border-strong')}>
            <div className="flex items-center gap-2">
                <div className={cn('w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0', style.icon)}>
                    {status === 'COM' && <CheckCircle className="w-3.5 h-3.5" />}
                    {status === 'EXE' && <Play className="w-3.5 h-3.5 fill-current" />}
                    {status === 'SUS' && <Pause className="w-3.5 h-3.5 fill-current" />}
                    {status === 'PENDING' &&
                        (index !== undefined ? (
                            <span className="text-3xs font-mono font-bold">{index + 1}</span>
                        ) : (
                            <div className="w-1.5 h-1.5 rounded-full bg-fg-faint" />
                        ))}
                </div>

                <div className="flex-1 min-w-0 leading-tight">
                    <p className={cn('text-xs font-semibold truncate', NAME_TONE[status] ?? 'text-fg-soft')} title={operation.operation_name}>
                        {operation.operation_name}
                    </p>
                    <p className="text-2xs opacity-60 truncate" title={operation.machine_name}>{operation.machine_name}</p>
                </div>
            </div>

            {operation.diba_note && (
                <div className="mt-1 pt-1 border-t border-fg-strong/5 flex items-start gap-1 text-2xs">
                    <FileText className="w-3 h-3 text-primary mt-0.5 flex-shrink-0" />
                    <p className="leading-snug whitespace-pre-line text-fg-secondary">{operation.diba_note}</p>
                </div>
            )}
        </div>
    );
}
