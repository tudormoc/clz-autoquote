import { StatusBadge } from '@/components/ui/StatusBadge';
import { APP_COPY } from '@/locales';

/** "Allineato" when a row matches the DiBa, otherwise one line for each difference found. */
export function AlignmentCell({ issues }: { issues: string[] }) {
    if (issues.length === 0) return <StatusBadge tone="success">{APP_COPY.analytics.orderOperations.statusAligned}</StatusBadge>;

    return (
        <div className="flex flex-col gap-0.5">
            {issues.map((issue, index) => (
                <span key={index} className="text-3xs font-semibold text-warning-300">• {issue}</span>
            ))}
        </div>
    );
}
