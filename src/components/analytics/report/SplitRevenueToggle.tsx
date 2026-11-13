import { ChoiceButton } from '@/components/ui/ChoiceButton';
import { AlertTriangle } from '@/components/ui/icons';
import { APP_COPY } from '@/locales';

/**
 * "Parziale / Intero": whether orders invoiced partly outside the period count with their
 * whole revenue (includeAllRevenueForSplit filter of the revenue reports).
 */
export function SplitRevenueToggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
    const copy = APP_COPY.analytics.clientSummary;
    return (
        <ChoiceButton tone="warning" selected={active} onClick={onToggle} title={active ? copy.toggleFullTitle : copy.toggleSplitTitle} className="inline-flex items-center gap-1.5">
            <AlertTriangle size={16} />
            {active ? copy.toggleFull : copy.toggleSplit}
        </ChoiceButton>
    );
}
