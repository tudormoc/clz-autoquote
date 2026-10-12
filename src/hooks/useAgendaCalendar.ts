'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { postponeOccurrenceAction, quickAddAction } from '@/app/tasks/agenda-actions';
import { getDayLoadsAction, getRangeAction } from '@/app/tasks/task-actions';
import { APP_CONFIG } from '@/config/constants';
import { useActionData } from '@/hooks/useActionData';
import { useOccurrenceActions } from '@/hooks/useOccurrenceActions';
import { getTodayDate } from '@/lib/dateUtils';
import { notify } from '@/lib/notify';
import { addDays, weekStart } from '@/lib/tasks/dates';
import { formatIsoDate, formatShortDay } from '@/lib/tasks/describe';
import { isOpenStatus, type AgendaItem, type PlannedEntry } from '@/lib/tasks/types';
import { monthGrid, monthKey, shiftMonth } from '@/lib/tasks/week';
import { APP_COPY, fmt } from '@/locales';

export type CalendarMode = 'week' | 'month';

/** What the side panel shows: a stored occurrence, or a date a repeating task will have */
export type CalendarSelection = { kind: 'item'; item: AgendaItem } | { kind: 'planned'; entry: PlannedEntry };

/** What a day holds, in the order it is drawn */
export interface DayContent {
    open: AgendaItem[];
    done: AgendaItem[];
    planned: PlannedEntry[];
}

const EMPTY_DAY: DayContent = { open: [], done: [], planned: [] };

/** Time first (no time last), then the most important, then by title */
const byTimeAndWeight = (a: AgendaItem, b: AgendaItem) =>
    (a.dueTime ?? '99').localeCompare(b.dueTime ?? '99') || b.priority - a.priority || a.title.localeCompare(b.title);

/** Typing in a field must not move the calendar */
const isTyping = (target: EventTarget | null) =>
    target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/**
 * The Agenda calendar: week or month around a date, its data, the strip of the coming weeks, the side panel's
 * selection, and the changes made from it (tick, drag to another day, add on a day). A drag shows at once and is
 * saved behind; everything reloads after each change.
 */
export function useAgendaCalendar() {
    const today = getTodayDate();
    const [mode, setMode] = useState<CalendarMode>('week');
    const [anchor, setAnchor] = useState(today);
    const [selected, setSelected] = useState<CalendarSelection | null>(null);
    const [panelVersion, setPanelVersion] = useState(0);
    const [moved, setMoved] = useState<Record<number, string>>({});

    const range = useMemo(() => (mode === 'week' ? { start: weekStart(anchor), end: addDays(weekStart(anchor), 6) } : monthGrid(monthKey(anchor))), [mode, anchor]);
    const loadRange = useCallback(() => getRangeAction(range.start, range.end), [range.start, range.end]);
    const rangeData = useActionData(loadRange);

    const horizonStart = weekStart(today);
    const loadHorizon = useCallback(() => getDayLoadsAction(horizonStart, addDays(horizonStart, APP_CONFIG.TASKS.HORIZON_WEEKS * 7 - 1)), [horizonStart]);
    const horizon = useActionData(loadHorizon);

    const { reload: reloadRange } = rangeData;
    const { reload: reloadHorizon } = horizon;
    const reloadAll = useCallback(async () => {
        await Promise.all([reloadRange(), reloadHorizon()]);
        setMoved({});
        setPanelVersion((version) => version + 1);
    }, [reloadRange, reloadHorizon]);
    const actions = useOccurrenceActions(reloadAll, today);

    // The data of the range on screen; while another range loads, the old one is not shown on the new days
    const current = rangeData.data && rangeData.data.data.start === range.start ? rangeData.data.data : null;

    const days = useMemo(() => {
        const map = new Map<string, DayContent>();
        const day = (date: string) => {
            if (!map.has(date)) map.set(date, { open: [], done: [], planned: [] });
            return map.get(date) as DayContent;
        };
        for (const item of current?.items ?? []) {
            const date = moved[item.id] ?? item.dueDate;
            if (!date) continue;
            if (isOpenStatus(item.status)) day(date).open.push(item);
            else if (item.status === 'done') day(date).done.push(item);
        }
        for (const entry of current?.planned ?? []) day(entry.date).planned.push(entry);
        map.forEach((content) => content.open.sort(byTimeAndWeight));
        return map;
    }, [current, moved]);

    const shift = useCallback(
        (by: number) => setAnchor((date) => (mode === 'week' ? addDays(date, 7 * by) : `${shiftMonth(monthKey(date), by)}-01`)),
        [mode]
    );

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return;
            if (event.key === 'ArrowLeft') shift(-1);
            else if (event.key === 'ArrowRight') shift(1);
            else if (event.key === 't' || event.key === 'T') setAnchor(today);
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [shift, today]);

    /** Drag onto another day: shown there at once, then saved as "Rimanda" */
    const move = async (item: AgendaItem, date: string) => {
        setMoved((current) => ({ ...current, [item.id]: date }));
        try {
            const result = await postponeOccurrenceAction(item.id, item.version, date, null);
            if (result.success) notify.success(fmt(APP_COPY.tasks.messages.postponed, { date: formatIsoDate(date) }));
            else notify.error(result.error);
        } catch (err) {
            notify.failure(err);
        }
        await reloadAll();
    };

    /** A one-time task on that day, the person's own; true when added */
    const addOn = async (date: string, title: string): Promise<boolean> => {
        try {
            const result = await quickAddAction(title, date);
            if (!result.success) {
                notify.error(result.error);
                return false;
            }
            notify.success(fmt(APP_COPY.tasks.calendar.added, { day: formatShortDay(date) }));
            await reloadAll();
            return true;
        } catch (err) {
            notify.failure(err);
            return false;
        }
    };

    return {
        today,
        mode,
        setMode,
        anchor,
        range,
        data: current,
        loading: !current && !rangeData.error,
        error: rangeData.error,
        dayContent: (date: string) => days.get(date) ?? EMPTY_DAY,
        loads: horizon.data?.loads ?? null,
        horizonStart,
        shift,
        goTo: setAnchor,
        selected,
        select: setSelected,
        panelVersion,
        /** Reloads the calendar, the strip and the side panel (after a change made inside the panel) */
        refresh: reloadAll,
        actions,
        move,
        addOn,
    };
}

export type AgendaCalendar = ReturnType<typeof useAgendaCalendar>;
