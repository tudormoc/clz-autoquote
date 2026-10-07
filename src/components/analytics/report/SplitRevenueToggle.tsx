import { Button } from '@/components/ui/Button';
import { APP_COPY } from '@/locales';
import { cn } from '@/lib/utils';

/**
 * "Parziale / Intero": whether orders invoiced partly outside the period count with their
 * whole revenue (includeAllRevenueForSplit filter of the revenue reports).
 */
export function SplitRevenueToggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
    const copy = APP_COPY.analytics.clientSummary;
    return (
        <Button
            type="button"
            onClick={onToggle}
            variant={active ? 'primary' : 'secondary'}
            className={cn('gap-1.5 transition-all', active ? 'ring-2 ring-primary/50 shadow-lg shadow-primary/20' : 'hover:border-warning-300/50')}
            title={active ? copy.toggleFullTitle : copy.toggleSplitTitle}
        >
            <span className="text-base leading-none">⚠️</span>
            <span className="text-sm font-medium">{active ? copy.toggleFull : copy.toggleSplit}</span>
        </Button>
    );
}
