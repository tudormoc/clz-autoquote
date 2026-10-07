import { APP_CONFIG } from '@/config/constants';
import { cn } from '@/lib/utils';

/** Green / amber / red for a percentage measured against two thresholds */
export function scoreTone(value: number, good: number, fair: number) {
    if (value >= good) return 'text-success-500';
    if (value >= fair) return 'text-warning-300';
    return 'text-danger';
}

/** Margin amount with its percentage of revenue, coloured by MARGIN_THRESHOLDS */
export function MarginCell({ revenue, margin, format }: { revenue: number; margin: number; format: (value: number) => string }) {
    const percent = revenue > 0 ? (margin / revenue) * 100 : 0;
    const { GOOD, FAIR } = APP_CONFIG.ANALYTICS.MARGIN_THRESHOLDS;
    return (
        <>
            <div className="font-mono text-fg-strong font-semibold">{format(margin)}</div>
            <div className={cn('text-xs font-mono', scoreTone(percent, GOOD, FAIR))}>{percent.toFixed(1)}%</div>
        </>
    );
}

/** Y / N marker (e.g. "has revenue outside the period"), highlighted when set */
export function FlagCell({ on }: { on: boolean }) {
    return <span className={cn('font-mono text-xs', on ? 'text-warning-300' : 'text-fg-subtle')}>{on ? 'Y' : 'N'}</span>;
}
