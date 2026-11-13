'use client';

import { CalendarRange, ChevronLeft, ChevronRight, Inbox } from '@/components/ui/icons';
import { AgendaSearch } from '@/components/tasks/shared/AgendaSearch';
import { NewTaskButton } from '@/components/tasks/shared/NewTaskButton';
import { TaskFilters } from '@/components/tasks/shared/TaskFilters';
import { Button } from '@/components/ui/Button';
import type { AgendaCalendar, CalendarMode } from '@/hooks/useAgendaCalendar';
import { monthName } from '@/lib/format';
import { weekTitle } from '@/lib/tasks/describe';
import { isoWeekNumber } from '@/lib/tasks/week';
import { APP_COPY, fmt } from '@/locales';
import { ChoiceButton } from '@/components/ui/ChoiceButton';
import { titleClasses } from '@/components/ui/titleLook';
import { Meter } from '@/components/ui/Meter';

const copy = APP_COPY.tasks.calendar;
const MODES: CalendarMode[] = ['week', 'month'];

interface CalendarToolbarProps {
    calendar: AgendaCalendar;
    /** Done and total of the period on screen (null while it loads) */
    progress: { done: number; total: number } | null;
}

/** The period's name and how much of it is done; search; area / person filters; "Senza data"; back / today / forward; week or month; "Nuova attività" */
export function CalendarToolbar({ calendar, progress }: CalendarToolbarProps) {
    const { mode, setMode, anchor, range, shift, goTo, today } = calendar;
    const title = mode === 'week' ? weekTitle(range.start) : fmt(copy.month, { month: monthName(Number(anchor.slice(5, 7))), year: anchor.slice(0, 4) });
    const showsToday = today >= range.start && today <= range.end && (mode === 'week' || anchor.slice(0, 7) === today.slice(0, 7));
    const share = progress && progress.total > 0 ? progress.done / progress.total : 0;
    const undated = calendar.data?.undated.length ?? 0;

    return (
        <div className="shrink-0 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <div className="min-w-0">
                <h1 className={titleClasses('page', 'flex items-center gap-2.5')}>
                    <CalendarRange size={20} className="shrink-0 text-primary" />
                    {title}
                </h1>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
                    {mode === 'week' && <span>{fmt(copy.weekNumber, { n: isoWeekNumber(range.start) })}</span>}
                    {progress && (
                        <span className="inline-flex items-center gap-2">
                            <Meter className="w-24" value={share} />
                            {progress.total > 0 ? fmt(copy.progress, progress) : copy.nothingThisWeek}
                        </span>
                    )}
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <AgendaSearch className="sm:w-48" />
                <TaskFilters values={calendar.filters} onChange={calendar.setFilters} areas={calendar.filterOptions.areas} people={calendar.filterOptions.people} compact search={false} />
                {(undated > 0 || calendar.showUndated) && (
                    <Button
                        variant={calendar.showUndated ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() => calendar.setShowUndated(!calendar.showUndated)}
                        aria-pressed={calendar.showUndated}
                        title={copy.undatedToggle}
                    >
                        <Inbox size={14} />
                        {copy.undated}
                        <span className="font-mono">{undated}</span>
                    </Button>
                )}
                <div className="flex items-center gap-1">
                    <Button variant="secondary" size="icon" onClick={() => shift(-1)} title={copy.previous[mode]} aria-label={copy.previous[mode]}>
                        <ChevronLeft size={16} />
                    </Button>
                    <Button variant={showsToday ? 'ghost' : 'secondary'} size="sm" onClick={() => goTo(today)}>
                        {copy.today}
                    </Button>
                    <Button variant="secondary" size="icon" onClick={() => shift(1)} title={copy.next[mode]} aria-label={copy.next[mode]}>
                        <ChevronRight size={16} />
                    </Button>
                </div>
                <div className="flex gap-1">
                    {MODES.map((option) => (
                        <ChoiceButton key={option} size="sm" selected={mode === option} onClick={() => setMode(option)}>
                            {copy.views[option]}
                        </ChoiceButton>
                    ))}
                </div>
                <NewTaskButton />
            </div>
        </div>
    );
}
