'use client';

import { isoWeekday } from '@/lib/presence';
import { KIND_SPECS } from '@/lib/timesheet/kinds';
import type { DaySummary } from '@/lib/timesheet/types';
import { cn } from '@/lib/utils';
import { APP_COPY } from '@/locales';
import { DayStatusBadge } from './DayStatusBadge';
import { entryText, hoursText } from './labels';

/** "mer 4": the weekday's first letters and the day of the month */
function dayLabel(day: string): string {
    const weekday = APP_COPY.weekdays.long[isoWeekday(day) - 1].slice(0, 3).toLowerCase();
    return `${weekday} ${Number(day.slice(8, 10))}`;
}

interface DayListProps {
    days: readonly DaySummary[];
    today: string;
    /** Opens the day's editor */
    onOpen: (day: string) => void;
}

/** The days of the month one under the other: what each holds, its hours and its state; a click opens the day */
export function DayList({ days, today, onOpen }: DayListProps) {
    return (
        <ul className="bg-card border border-border rounded-lg divide-y divide-border/60 lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
            {days.map((summary) => {
                const isToday = summary.day === today;
                const quiet = summary.entries.length === 0 && summary.expected === 0;
                return (
                    <li key={summary.day}>
                        <button
                            type="button"
                            onClick={() => onOpen(summary.day)}
                            title={APP_COPY.timesheet.day.open}
                            className={cn(
                                'w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/40',
                                isToday && 'bg-primary/5',
                                quiet && 'text-fg-subtle'
                            )}
                        >
                            <span className={cn('w-14 shrink-0', isToday ? 'font-semibold text-primary' : 'text-fg-secondary')}>{dayLabel(summary.day)}</span>
                            <span className="min-w-0 flex-1 flex flex-wrap gap-x-3 gap-y-0.5">
                                {summary.entries.length === 0 ? (
                                    <span className="text-fg-faint">{summary.status === 'closed' ? summary.closedReason : '—'}</span>
                                ) : (
                                    summary.entries.map((entry) => (
                                        <span key={entry.id} className={cn(KIND_SPECS[entry.kind].input === 'times' && 'font-mono')} title={entry.note || undefined}>
                                            {entryText(entry)}
                                        </span>
                                    ))
                                )}
                            </span>
                            <span className="w-16 shrink-0 text-right font-mono text-fg-secondary">{summary.hours.ordinarie > 0 ? hoursText(summary.hours.ordinarie) : ''}</span>
                            <span className="w-32 shrink-0 text-right">
                                <DayStatusBadge summary={summary} today={today} />
                            </span>
                        </button>
                    </li>
                );
            })}
        </ul>
    );
}
