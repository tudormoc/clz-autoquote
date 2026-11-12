import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type KpiTone = 'info' | 'success' | 'danger';

const TONES: Record<KpiTone, { icon: string; value: string; note: string }> = {
    info: { icon: 'bg-info-500/10 text-info-400', value: 'text-info-300', note: 'text-fg-muted' },
    success: { icon: 'bg-success-500/10 text-success-400', value: 'text-success-300', note: 'text-success-400/90' },
    danger: { icon: 'bg-danger-500/10 text-danger-400', value: 'text-danger-300', note: 'text-danger-400/90' },
};

interface KpiCardProps {
    label: string;
    icon: LucideIcon;
    tone: KpiTone;
    /** The amount, already formatted */
    value: string;
    /** The small text under the amount */
    note: string;
    /** The note as a filled badge (Surplus / Deficit) instead of plain figures */
    noteAsBadge?: boolean;
}

/** One of the four amounts at the top of Flusso Monetario: its name and icon, the amount, a small note under it */
export function KpiCard({ label, icon: Icon, tone, value, note, noteAsBadge = false }: KpiCardProps) {
    const style = TONES[tone];
    return (
        <div className="bg-card border border-border hover:border-border-strong/80 transition-all rounded-xl p-4 shadow-sm relative overflow-hidden group">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-fg-muted">{label}</span>
                <div className={cn('p-2 rounded-lg group-hover:scale-105 transition-transform', style.icon)}>
                    <Icon size={18} />
                </div>
            </div>

            <div className={cn('text-2xl font-bold font-mono tracking-tight', style.value)}>{value}</div>

            <div className="flex items-center justify-end text-2xs text-fg-subtle mt-2 pt-2 border-t border-border/80">
                <span className={cn('text-3xs', noteAsBadge ? ['px-1.5 py-0.5 rounded font-bold', style.icon] : ['font-mono', style.note])}>{note}</span>
            </div>
        </div>
    );
}
