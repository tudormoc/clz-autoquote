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
            "text-xs font-medium text-zinc-200 bg-zinc-800 px-3 py-1 rounded border border-zinc-700 flex items-center gap-2",
            className
        )}>
            <span className="text-[10px] text-zinc-400">{label}</span>
            <span className="text-zinc-100 font-mono">
                {value}
                {detail && <span className="text-[10px] text-zinc-400 ml-1">{detail}</span>}
            </span>
        </div>
    );
}
