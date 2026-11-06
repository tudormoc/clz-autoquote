import { Check } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { monthComplete, totalHours } from '@/lib/timesheet/month';
import { HOUR_FIELDS, type DaySummary } from '@/lib/timesheet/types';
import { APP_COPY } from '@/locales';
import { fieldLabel, hoursText } from './labels';

/** One line with the month's hours per column (the empty ones left out) and, once every working day is covered, "Mese completo" */
export function MonthTotals({ days }: { days: readonly DaySummary[] }) {
    const totals = totalHours(days);
    const parts = HOUR_FIELDS.filter((field) => totals[field] > 0).map((field) => `${fieldLabel(field)} ${hoursText(totals[field])}`);
    return (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
            <span>
                {APP_COPY.timesheet.month.totals}: <span className="font-mono text-fg-secondary">{parts.length > 0 ? parts.join(' · ') : '—'}</span>
            </span>
            {monthComplete(days) && (
                <StatusBadge tone="success">
                    <Check size={12} />
                    {APP_COPY.timesheet.month.complete}
                </StatusBadge>
            )}
        </p>
    );
}
