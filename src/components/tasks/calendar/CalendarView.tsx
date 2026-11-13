'use client';

import { useMemo } from 'react';
import { Inbox } from '@/components/ui/icons';
import { useCanEdit } from '@/components/auth/AccessProvider';
import { CardDock } from '@/components/tasks/calendar/CardDock';
import { CalendarToolbar } from '@/components/tasks/calendar/CalendarToolbar';
import { MonthGrid } from '@/components/tasks/calendar/MonthGrid';
import { TaskPanel } from '@/components/tasks/calendar/TaskPanel';
import { WeekBoard } from '@/components/tasks/calendar/WeekBoard';
import { WeekHorizon } from '@/components/tasks/calendar/WeekHorizon';
import { OccurrenceDialog } from '@/components/tasks/occurrence/OccurrenceDialog';
import { LoadState } from '@/components/ui/LoadState';
import { useAgendaCalendar } from '@/hooks/useAgendaCalendar';
import { useCalendarDrag } from '@/hooks/useCalendarDrag';
import { monthKey } from '@/lib/tasks/week';
import { APP_COPY } from '@/locales';

/**
 * Agenda → Calendario. The week board (default): the coming weeks at a glance on top, what is late in a dock (and,
 * opened from the toolbar, what has no date yet, to drag onto a day), seven day columns with today wider; tick to mark
 * done, drag to another day to postpone or up / down to change its place, "+" to add on a day, click for the side
 * panel, right-click (or hold on a phone) for its actions. Or the month grid. ← → change period, T comes back to today.
 */
export function CalendarView() {
    const calendar = useAgendaCalendar();
    const canEdit = useCanEdit();
    const drag = useCalendarDrag(calendar.today, calendar.drop);
    const { mode, data, range, anchor, selected, actions, error } = calendar;

    // Done and total of the period (a month grid counts only the month's own days)
    const progress = useMemo(() => {
        if (!data) return null;
        const counted = data.items.filter(
            (item) => item.status !== 'skipped' && item.status !== 'cancelled' && (mode === 'week' || (item.dueDate !== null && monthKey(item.dueDate) === monthKey(anchor)))
        );
        return { done: counted.filter((item) => item.status === 'done').length, total: counted.length };
    }, [data, mode, anchor]);

    return (
        <div className="flex flex-col gap-3 lg:h-full">
            <CalendarToolbar calendar={calendar} progress={progress} />
            {mode === 'week' && <WeekHorizon start={calendar.horizonStart} shown={range.start} today={calendar.today} loads={calendar.loads} onPick={calendar.goTo} />}
            {calendar.showUndated && (
                <CardDock
                    title={APP_COPY.tasks.calendar.undated}
                    hint={APP_COPY.tasks.calendar.undatedHint}
                    icon={Inbox}
                    tone="muted"
                    items={data?.undated ?? []}
                    calendar={calendar}
                    drag={drag}
                    canEdit={canEdit}
                />
            )}
            {error ? (
                <LoadState loading={false} error={error} />
            ) : mode === 'week' ? (
                <WeekBoard calendar={calendar} drag={drag} canEdit={canEdit} />
            ) : (
                <MonthGrid calendar={calendar} drag={drag} canEdit={canEdit} />
            )}

            {selected && (
                <TaskPanel
                    key={`${selected.kind === 'item' ? selected.item.taskId : selected.entry.taskId}:${calendar.panelVersion}`}
                    selection={selected}
                    calendar={calendar}
                />
            )}
            {actions.dialog && (
                <OccurrenceDialog
                    kind={actions.dialog.kind}
                    occurrence={actions.dialog.occurrence}
                    today={calendar.today}
                    busy={actions.busy}
                    onSubmit={actions.submitDialog}
                    onClose={actions.close}
                />
            )}
        </div>
    );
}
