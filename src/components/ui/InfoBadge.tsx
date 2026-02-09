import React from 'react';
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
            "text-[10px] font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded border border-border flex items-center gap-2",
            className
        )}>
            <span className="uppercase tracking-tighter text-[9px]">{label}</span>
            <span className="text-foreground font-mono">
                {value}
                {detail && <span className="text-[9px] text-muted-foreground ml-1">{detail}</span>}
            </span>
        </div>
    );
}
