import { totalHours } from '@/lib/timesheet/month';
import { HOUR_FIELDS, type DaySummary } from '@/lib/timesheet/types';
import { APP_COPY } from '@/locales';
import { fieldLabel, hoursText } from './labels';

/** One line with the month's hours per column, the empty columns left out */
export function MonthTotals({ days }: { days: readonly DaySummary[] }) {
    const totals = totalHours(days);
    const parts = HOUR_FIELDS.filter((field) => totals[field] > 0).map((field) => `${fieldLabel(field)} ${hoursText(totals[field])}`);
    return (
        <p className="text-xs text-fg-muted">
            {APP_COPY.timesheet.month.totals}: <span className="font-mono text-fg-secondary">{parts.length > 0 ? parts.join(' · ') : '—'}</span>
        </p>
    );
}
