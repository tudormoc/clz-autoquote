'use client';

import { weekdayOf } from '@/lib/dateUtils';
import { KIND_SPECS } from '@/lib/timesheet/kinds';
import type { DaySummary } from '@/lib/timesheet/types';
import { cn } from '@/lib/utils';
import { APP_COPY } from '@/locales';
import { DayStatusBadge } from './DayStatusBadge';
import { entryText, hoursText } from './labels';
import { surfaceClasses } from '@/components/ui/Surface';
import { MenuRow } from '@/components/ui/MenuRow';
import { FoldArrow } from '@/components/ui/FoldArrow';
import { EMPTY_VALUE } from '@/lib/format';

/** "mer 4": the weekday's first letters and the day of the month */
function dayLabel(day: string): string {
    const weekday = APP_COPY.weekdays.long[weekdayOf(day) - 1].slice(0, 3).toLowerCase();
    return `${weekday} ${Number(day.slice(8, 10))}`;
}

interface DayListProps {
    days: readonly DaySummary[];
    today: string;
    /** YYYY-MM-DD, the first day of the timesheet (Regole Presenze): earlier rows are shown but locked */
    startDay: string;
    /** The day opened in place, null when all are closed */
    expanded: string | null;
    /** A click on a day opens it (or closes it again) */
    onToggle: (day: string) => void;
    /** The opened day's panel (DayPanel), drawn under its row */
    panel?: React.ReactNode;
}

/** The days of the month one under the other: what each holds, its hours and its state; a click opens the day in place */
export function DayList({ days, today, startDay, expanded, onToggle, panel }: DayListProps) {
    return (
        <ul className={surfaceClasses('panel', 'divide-y divide-border/60 lg:flex-1 lg:min-h-0 lg:overflow-y-auto')}>
            {days.map((summary) => {
                const isToday = summary.day === today;
                const isOpen = summary.day === expanded;
                const quiet = summary.entries.length === 0 && summary.expected === 0;
                // Days before the start of the timesheet are shown but locked (owner, 2026-11-05)
                const locked = summary.day < startDay;
                return (
                    <li key={summary.day}>
                        <MenuRow
                            disabled={locked}
                            onClick={() => onToggle(summary.day)}
                            aria-expanded={isOpen}
                            title={locked || isOpen ? undefined : APP_COPY.timesheet.day.open}
                            className={cn(
                                // On a phone the lines of a filled day wrap to their own row (gap-y keeps the two rows tight)
                                'flex-wrap sm:flex-nowrap gap-x-3 gap-y-0.5',
                                // A free day (weekend, before the start) keeps its size but looks switched off: greyed, a dashed line
                                quiet && !isOpen && 'text-fg-faint bg-muted/20 opacity-70',
                                isToday && 'bg-primary/5',
                                isOpen && 'bg-muted/40'
                            )}
                        >
                            <span className={cn('w-14 shrink-0', isToday ? 'font-semibold text-primary' : quiet ? undefined : 'text-fg-secondary')}>{dayLabel(summary.day)}</span>
                            <span
                                className={cn(
                                    'min-w-0 flex flex-wrap gap-x-3 gap-y-0.5',
                                    // Filled lines get their own row on a phone; an empty day stays on one line
                                    summary.entries.length > 0 ? 'order-last basis-full sm:order-none sm:basis-0 sm:flex-1' : 'flex-1'
                                )}
                            >
                                {summary.entries.length === 0 ? (
                                    quiet && !isOpen && summary.status !== 'closed' ? (
                                        <span className="flex-1 self-center border-t border-dashed border-border/60" aria-hidden />
                                    ) : (
                                        <span className="text-fg-faint">{summary.status === 'closed' ? summary.closedReason : EMPTY_VALUE}</span>
                                    )
                                ) : (
                                    summary.entries.map((entry) => (
                                        <span key={entry.id} className={cn(KIND_SPECS[entry.kind].input === 'times' && 'font-mono')} title={entry.note || undefined}>
                                            {entryText(entry)}
                                        </span>
                                    ))
                                )}
                            </span>
                            <span className="ml-auto w-auto shrink-0 text-right font-mono text-fg-secondary sm:ml-0 sm:w-16">{summary.hours.ordinarie > 0 ? hoursText(summary.hours.ordinarie) : ''}</span>
                            <span className="w-auto shrink-0 text-right sm:w-28">
                                <DayStatusBadge summary={summary} today={today} />
                            </span>
                            <FoldArrow open={isOpen} size={14} className={cn('text-fg-faint', (locked || (quiet && !isOpen)) && 'invisible')} />
                        </MenuRow>
                        {isOpen && <div className="border-t border-border/60 bg-muted/20 px-3 py-3 sm:pl-20">{panel}</div>}
                    </li>
                );
            })}
        </ul>
    );
}
