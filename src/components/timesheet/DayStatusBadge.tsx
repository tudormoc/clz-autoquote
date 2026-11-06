import { Check } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { DaySummary } from '@/lib/timesheet/types';
import { APP_COPY, fmt } from '@/locales';
import { STATUS_TONES, formatStepHours } from './labels';

const copy = APP_COPY.timesheet.status;

/**
 * The state of a day, kept quiet: a covered day is a small check, a free day or one still to come shows nothing,
 * and "Mancano … h" is red only when the day holds nothing at all (amber when something is already there).
 */
export function DayStatusBadge({ summary, today }: { summary: DaySummary; today: string }) {
    if (summary.status === 'free' || (summary.status === 'pending' && summary.day > today)) return null;
    if (summary.status === 'ok') {
        return (
            <span title={copy.ok} className="inline-flex align-middle text-success-500">
                <Check size={16} aria-label={copy.ok} />
            </span>
        );
    }
    const text =
        summary.status === 'short'
            ? fmt(copy.short, { hours: formatStepHours(summary.missing) })
            : summary.status === 'closed' && summary.closedReason
              ? `${copy.closed} · ${summary.closedReason}`
              : copy[summary.status];
    const tone = summary.status === 'short' && summary.entries.length > 0 ? 'warning' : STATUS_TONES[summary.status];
    return <StatusBadge tone={tone}>{text}</StatusBadge>;
}
