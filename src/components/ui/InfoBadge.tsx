import { cn } from '@/lib/utils';

interface InfoBadgeProps {
    label: string;
    value: string | number;
    detail?: string;
    className?: string;
}

/**
 * Reusable info badge component for displaying calculated values and configurations.
 * Used across forms to show totals, configurations, and computed values.
 */
export function InfoBadge({ label, value, detail, className }: InfoBadgeProps) {
    return (
        <div className={cn(
            "text-xs font-medium text-fg-soft bg-muted px-3 py-1 rounded border border-border-strong flex items-center gap-2",
            className
        )}>
            <span className="text-3xs text-fg-muted">{label}</span>
            <span className="text-fg font-mono">
                {value}
                {detail && <span className="text-3xs text-fg-muted ml-1">{detail}</span>}
            </span>
        </div>
    );
}
