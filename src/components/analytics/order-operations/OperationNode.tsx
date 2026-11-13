import { CheckCircle, FileText, Pause, Play } from '@/components/ui/icons';
import { IconTile, type IconTone } from '@/components/ui/IconTile';
import { SURFACE_TONE, surfaceClasses, type SurfaceTone } from '@/components/ui/Surface';
import type { FlowOperation, FlowStatus } from '@/lib/orders/flow';
import { cn } from '@/lib/utils';

/** How a step looks by its state: the tone of its box, of its icon, and of its text */
const STATUS: Record<FlowStatus, { box?: SurfaceTone; icon: IconTone; text: string }> = {
    COM: { box: 'success', icon: 'success', text: 'text-success-400' },
    EXE: { box: 'info', icon: 'info', text: 'text-info-400' },
    SUS: { box: 'warning', icon: 'warning', text: 'text-warning-300' },
    PENDING: { icon: 'neutral', text: 'text-fg-soft' },
};

interface OperationNodeProps {
    operation: FlowOperation;
    /** Position in the column; shown inside a step that has not started */
    index?: number;
}

/** One step of the production flow: status icon, operation, machine and the DiBa note when there is one. */
export function OperationNode({ operation, index }: OperationNodeProps) {
    const { status } = operation;
    const look = STATUS[status];

    return (
        <div className={surfaceClasses('inset', look.box && SURFACE_TONE[look.box], 'px-2.5 py-1.5', look.text)}>
            <div className="flex items-center gap-2">
                <IconTile tone={look.icon} className={cn('size-6 p-0', status === 'EXE' && 'animate-pulse motion-reduce:animate-none')}>
                    {status === 'COM' && <CheckCircle size={14} />}
                    {status === 'EXE' && <Play size={14} className="fill-current" />}
                    {status === 'SUS' && <Pause size={14} className="fill-current" />}
                    {status === 'PENDING' && (index !== undefined ? <span className="text-3xs font-mono font-bold">{index + 1}</span> : <span className="size-1.5 rounded-full bg-fg-faint" />)}
                </IconTile>

                <div className="flex-1 min-w-0 leading-tight">
                    <p className="text-xs font-semibold truncate" title={operation.operation_name}>
                        {operation.operation_name}
                    </p>
                    <p className="text-2xs opacity-60 truncate" title={operation.machine_name}>
                        {operation.machine_name}
                    </p>
                </div>
            </div>

            {operation.diba_note && (
                <div className="mt-1 pt-1 border-t border-border flex items-start gap-1 text-2xs">
                    <FileText size={12} className="text-primary mt-0.5 shrink-0" />
                    <p className="leading-snug whitespace-pre-line text-fg-secondary">{operation.diba_note}</p>
                </div>
            )}
        </div>
    );
}
