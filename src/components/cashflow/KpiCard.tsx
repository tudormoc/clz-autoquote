import type { LucideIcon } from '@/components/ui/icons';
import { IconTile, type IconTone } from '@/components/ui/IconTile';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Surface } from '@/components/ui/Surface';
import { cn } from '@/lib/utils';
import { titleClasses } from '@/components/ui/titleLook';

export type KpiTone = Extract<IconTone, 'info' | 'success' | 'danger'>;

const VALUE: Record<KpiTone, string> = {
    info: 'text-info-300',
    success: 'text-success-300',
    danger: 'text-danger-300',
};

interface KpiCardProps {
    label: string;
    icon: LucideIcon;
    tone: KpiTone;
    /** The amount, already formatted */
    value: string;
    /** The small text under the amount */
    note: string;
    /** The note as a badge (Surplus / Deficit) instead of plain figures */
    noteAsBadge?: boolean;
}

/** One of the four amounts at the top of Flusso Monetario: its name and icon, the amount, a small note under it */
export function KpiCard({ label, icon: Icon, tone, value, note, noteAsBadge = false }: KpiCardProps) {
    return (
        <Surface className="p-4">
            <div className="flex items-center justify-between mb-2">
                <span className={titleClasses('label')}>{label}</span>
                <IconTile tone={tone}>
                    <Icon size={18} />
                </IconTile>
            </div>

            <div className={cn('text-2xl font-bold font-mono tracking-tight', VALUE[tone])}>{value}</div>

            <div className="flex items-center justify-end mt-2 pt-2 border-t border-border/80">
                {noteAsBadge ? <StatusBadge tone={tone}>{note}</StatusBadge> : <span className="font-mono text-3xs text-fg-muted">{note}</span>}
            </div>
        </Surface>
    );
}
