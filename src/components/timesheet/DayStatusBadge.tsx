import { StatusBadge } from '@/components/ui/StatusBadge';
import type { DaySummary } from '@/lib/timesheet/types';
import { APP_COPY, fmt } from '@/locales';
import { STATUS_TONES, formatStepHours } from './labels';

const copy = APP_COPY.timesheet.status;

/** The state of a day as a small label; a free day, or one still to come, shows nothing */
export function DayStatusBadge({ summary, today }: { summary: DaySummary; today: string }) {
    if (summary.status === 'free' || (summary.status === 'pending' && summary.day > today)) return null;
    const text =
        summary.status === 'short'
            ? fmt(copy.short, { hours: formatStepHours(summary.missing) })
            : summary.status === 'closed' && summary.closedReason
              ? `${copy.closed} · ${summary.closedReason}`
              : copy[summary.status];
    return <StatusBadge tone={STATUS_TONES[summary.status]}>{text}</StatusBadge>;
}
