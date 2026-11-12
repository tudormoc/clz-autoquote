'use client';

import { APP_CONFIG } from '@/config/constants';
import { addDays } from '@/lib/dateUtils';
import { formatDayMonth } from '@/lib/format';
import type { DayLoad } from '@/lib/tasks/types';
import { isoWeekNumber, weekDays } from '@/lib/tasks/week';
import { APP_COPY, fmt } from '@/locales';
import { cn } from '@/lib/utils';

const copy = APP_COPY.tasks.calendar;

interface WeekHorizonProps {
    /** Monday of this week: the strip starts here */
    start: string;
    /** Monday of the week on screen */
    shown: string;
    today: string;
    loads: Record<string, DayLoad> | null;
    onPick: (monday: string) => void;
}

/**
 * The coming weeks at a glance: one tile per week with a tiny bar per day (how much is due, critical ones red).
 * A busy week stands out before it arrives; a click shows it.
 */
export function WeekHorizon({ start, shown, today, loads, onPick }: WeekHorizonProps) {
    const weeks = Array.from({ length: APP_CONFIG.TASKS.HORIZON_WEEKS }, (_, i) => addDays(start, i * 7));
    const busiest = Math.max(APP_CONFIG.TASKS.DAY_FULL, ...Object.values(loads ?? {}).map((load) => load.count));

    return (
        <nav aria-label={copy.horizon} className="flex gap-1.5 overflow-x-auto shrink-0">
            {weeks.map((monday) => {
                const days = weekDays(monday);
                const total = days.reduce((sum, day) => sum + (loads?.[day]?.count ?? 0), 0);
                const critical = days.reduce((sum, day) => sum + (loads?.[day]?.critical ?? 0), 0);
                const label = fmt(copy.horizonWeek, { n: isoWeekNumber(monday), count: total }) + (critical > 0 ? ` · ${fmt(copy.horizonCritical, { n: critical })}` : '');
                return (
                    <button
                        key={monday}
                        type="button"
                        onClick={() => onPick(monday)}
                        title={label}
                        aria-label={label}
                        aria-current={monday === shown ? 'true' : undefined}
                        className={cn(
                            'flex-1 min-w-24 flex items-end gap-2 rounded-lg border px-2 py-1 text-left transition-colors',
                            monday === shown ? 'border-primary/60 bg-primary/10' : 'border-border bg-card hover:border-border-strong'
                        )}
                    >
                        <span className="shrink-0 flex flex-col leading-tight">
                            <span className={cn('text-2xs', monday === shown ? 'text-primary font-semibold' : 'text-fg-muted')}>{formatDayMonth(monday)}</span>
                            <span className={cn('text-3xs font-mono', critical > 0 ? 'text-danger-400' : 'text-fg-subtle')}>{total || '·'}</span>
                        </span>
                        <span className="flex-1 flex items-end gap-0.5 h-5" aria-hidden>
                            {days.map((day) => {
                                const load = loads?.[day];
                                const height = load ? Math.max(15, Math.round((load.count / busiest) * 100)) : 6;
                                return (
                                    <span
                                        key={day}
                                        className={cn(
                                            'flex-1 rounded-sm',
                                            !load ? 'bg-muted' : load.critical > 0 ? 'bg-danger-400' : day === today ? 'bg-primary' : 'bg-fg-faint'
                                        )}
                                        style={{ height: `${height}%` }}
                                    />
                                );
                            })}
                        </span>
                    </button>
                );
            })}
        </nav>
    );
}
