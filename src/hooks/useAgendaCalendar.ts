'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { orderDayAction, postponeOccurrenceAction, quickAddAction, scheduleOccurrenceAction } from '@/app/tasks/agenda-actions';
import { getDayLoadsAction, getRangeAction, setTaskPriorityAction } from '@/app/tasks/task-actions';
import { APP_CONFIG } from '@/config/constants';
import { TASK_PAGES } from '@/config/navigation';
import { EMPTY_FILTERS, matchesFilters, type TaskFilterValues } from '@/components/tasks/shared/TaskFilters';
import { useActionData } from '@/hooks/useActionData';
import { useOccurrenceActions } from '@/hooks/useOccurrenceActions';
import { getTodayDate } from '@/lib/dateUtils';
import { notify } from '@/lib/notify';
import { addDays, maxDate, weekStart } from '@/lib/tasks/dates';
import { compareInDay, placeAmong, placeAt, sameOrder } from '@/lib/tasks/dayOrder';
import { formatIsoDate, formatShortDay } from '@/lib/tasks/describe';
import { isOpenStatus, type AgendaItem, type PlannedEntry, type Priority } from '@/lib/tasks/types';
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

/** Where an open card stands in its day, when it can change place there */
export interface DayPlace {
    first: boolean;
    last: boolean;
}

/** Typing in a field must not move the calendar */
const isTyping = (target: EventTarget | null) =>
    target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/**
 * The Agenda calendar: week or month around a date, its data, the strip of the coming weeks, the side panel's
 * selection, the area / person filters, and the changes made from it (tick, drag to another day or to another place
 * in its day, "In cima" / "In fondo", priority, add on a day). A drag shows at once and is saved behind; everything
 * reloads after each change.
 */
export function useAgendaCalendar() {
    const today = getTodayDate();
    const router = useRouter();
    const [mode, setMode] = useState<CalendarMode>('week');
    const [anchor, setAnchor] = useState(today);
    const [selected, setSelected] = useState<CalendarSelection | null>(null);
    const [panelVersion, setPanelVersion] = useState(0);
    // Moves and day orders shown before the reload confirms them: id → new day, day → ids first to last
    const [moved, setMoved] = useState<Record<number, string>>({});
    const [ordered, setOrdered] = useState<Record<string, number[]>>({});
    const [filters, setFilters] = useState<TaskFilterValues>(EMPTY_FILTERS);
    const [showUndated, setShowUndated] = useState(false);

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
        setOrdered({});
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
        // A card moved or placed but not reloaded yet: drawn on its new day, in its new place
        const shown = (item: AgendaItem, date: string): AgendaItem => {
            const order = ordered[date];
            if (order) return { ...item, dueDate: date, dayOrder: order.includes(item.id) ? order.indexOf(item.id) + 1 : null };
            return date === item.dueDate ? item : { ...item, dueDate: date, dayOrder: null };
        };
        for (const item of current?.items ?? []) {
            const date = moved[item.id] ?? item.dueDate;
            if (!date) continue;
            if (isOpenStatus(item.status)) day(date).open.push(shown(item, date));
            else if (item.status === 'done') day(date).done.push(item);
        }
        // Late or undated cards just dragged onto a day of the range
        const inRange = new Set((current?.items ?? []).map((item) => item.id));
        for (const item of [...(current?.overdue ?? []), ...(current?.undated ?? [])]) {
            const date = moved[item.id];
            if (current && date && !inRange.has(item.id) && date >= current.start && date <= current.end) day(date).open.push(shown(item, date));
        }
        for (const entry of current?.planned ?? []) day(entry.date).planned.push(entry);
        map.forEach((content) => content.open.sort(compareInDay));
        return map;
    }, [current, moved, ordered]);

    // The filters (area, person); null = everything shows
    const pass = useMemo(() => {
        if (!current || (filters.area === '' && filters.person === '')) return null;
        const { areas, people } = current;
        const nameOf = (key: string | null) => people.find((person) => person.key === key)?.name ?? null;
        return {
            item: (card: AgendaItem) => matchesFilters(card, filters, areas),
            entry: (entry: PlannedEntry) => matchesFilters({ ...entry, assigneeName: nameOf(entry.assignee) }, filters, areas),
        };
    }, [current, filters]);
    // The range as shown: filtered, and the docks without the cards just dragged out of them
    const data = useMemo(() => {
        if (!current) return null;
        const docked = (item: AgendaItem) => !moved[item.id] && (!pass || pass.item(item));
        return {
            ...current,
            items: pass ? current.items.filter(pass.item) : current.items,
            overdue: current.overdue.filter(docked),
            undated: current.undated.filter(docked),
            planned: pass ? current.planned.filter(pass.entry) : current.planned,
        };
    }, [current, pass, moved]);
    const shownDays = useMemo(() => {
        if (!pass) return days;
        const map = new Map<string, DayContent>();
        days.forEach((content, date) => map.set(date, { open: content.open.filter(pass.item), done: content.done.filter(pass.item), planned: content.planned.filter(pass.entry) }));
        return map;
    }, [days, pass]);

    // A day's open cards: all of them (the order is saved on all), or only the ones the filters show
    const openIds = (date: string) => (days.get(date)?.open ?? []).map((card) => card.id);
    const shownIds = (date: string) => (shownDays.get(date)?.open ?? []).map((card) => card.id);

    const shift = useCallback(
        (by: number) => setAnchor((date) => (mode === 'week' ? addDays(date, 7 * by) : `${shiftMonth(monthKey(date), by)}-01`)),
        [mode]
    );

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            // A focused card uses the arrows itself (it calls preventDefault)
            if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return;
            if (event.key === 'ArrowLeft') shift(-1);
            else if (event.key === 'ArrowRight') shift(1);
            else if (event.key === 't' || event.key === 'T') setAnchor(today);
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [shift, today]);

    /** Saves the order of a day's open cards (shown at once) */
    const saveOrder = async (date: string, ids: number[]) => {
        setOrdered((current) => ({ ...current, [date]: ids }));
        try {
            const result = await orderDayAction(date, ids);
            if (!result.success) notify.error(result.error);
        } catch (err) {
            notify.failure(err);
        }
    };

    /**
     * A card dropped on a day. On its own day it takes its new place (`slot`, null = unchanged). On another day it is
     * postponed there ("Rimanda"; a card without a date gets it as its first date) and takes the place it was dropped
     * at among that day's cards (null = after them).
     */
    const drop = async (item: AgendaItem, date: string, slot: number | null) => {
        const ids = openIds(date);
        const order = slot === null ? null : placeAmong(ids, shownIds(date), item.id, slot);
        if (date === item.dueDate) {
            if (!order || sameOrder(order, ids)) return;
            await saveOrder(date, order);
            await reloadAll();
            return;
        }
        setMoved((current) => ({ ...current, [item.id]: date }));
        const placed = order && ids.length > 0 ? order : null;
        if (placed) setOrdered((current) => ({ ...current, [date]: placed }));
        try {
            const first = item.dueDate === null;
            const result = first ? await scheduleOccurrenceAction(item.id, item.version, date) : await postponeOccurrenceAction(item.id, item.version, date, null);
            if (result.success) {
                notify.success(fmt(first ? APP_COPY.tasks.messages.scheduled : APP_COPY.tasks.messages.postponed, { date: formatIsoDate(date) }));
                if (placed) await saveOrder(date, placed);
            } else notify.error(result.error);
        } catch (err) {
            notify.failure(err);
        }
        await reloadAll();
    };

    /** Where an open card of today or later stands in its day; null when it cannot change place (alone, late, closed) */
    const placeOf = (item: AgendaItem): DayPlace | null => {
        if (!isOpenStatus(item.status) || !item.dueDate || item.dueDate < today) return null;
        const ids = shownIds(item.dueDate);
        const at = ids.indexOf(item.id);
        return at < 0 || ids.length < 2 ? null : { first: at === 0, last: at === ids.length - 1 };
    };

    /**
     * Keys on a focused open card: Space = done, ← → = a day earlier / later (a late card → goes to today; never before
     * today), ↑ ↓ = one place up / down in its day. Answers the running change, or null when the key is not one of these.
     */
    const cardKey = (item: AgendaItem, key: string): Promise<unknown> | null => {
        if (!isOpenStatus(item.status) || !item.dueDate) return null;
        const date = item.dueDate;
        if (key === ' ') return actions.done(item);
        if (key === 'ArrowLeft' || key === 'ArrowRight') {
            const to = key === 'ArrowLeft' ? addDays(date, -1) : [addDays(date, 1), today].reduce(maxDate);
            return to < today ? Promise.resolve() : drop(item, to, null);
        }
        if (key === 'ArrowUp' || key === 'ArrowDown') {
            if (!placeOf(item)) return Promise.resolve();
            const at = shownIds(date).indexOf(item.id);
            return drop(item, date, key === 'ArrowUp' ? at - 1 : at + 1);
        }
        return null;
    };

    /** "In cima" / "In fondo" of its day */
    const toEdge = async (item: AgendaItem, edge: 'top' | 'bottom') => {
        if (!item.dueDate) return;
        const ids = openIds(item.dueDate);
        await saveOrder(item.dueDate, placeAt(ids, item.id, edge === 'top' ? 0 : ids.length));
        await reloadAll();
    };

    /** The priority of the card's task (all its dates) */
    const setPriority = async (item: AgendaItem, priority: Priority) => {
        try {
            const result = await setTaskPriorityAction(item.taskId, priority);
            if (!result.success) notify.error(result.error);
        } catch (err) {
            notify.failure(err);
        }
        await reloadAll();
    };

    /** After a task was deleted: the side panel closes if it showed it, everything reloads */
    const taskDeleted = async (taskId: number) => {
        setSelected((current) => (current && (current.kind === 'item' ? current.item.taskId : current.entry.taskId) === taskId ? null : current));
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
        data,
        loading: !current && !rangeData.error,
        error: rangeData.error,
        dayContent: (date: string) => shownDays.get(date) ?? EMPTY_DAY,
        filters,
        setFilters,
        /** The "Senza data" strip is open */
        showUndated,
        setShowUndated,
        /** What the filters choose from (kept from the last period while the next one loads) */
        filterOptions: { areas: rangeData.data?.data.areas ?? [], people: rangeData.data?.data.people ?? [] },
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
        drop,
        placeOf,
        toEdge,
        cardKey,
        setPriority,
        taskDeleted,
        /** The task's own page, or the form for a copy of it ("Duplica") */
        openTask: (taskId: number, copy = false) => router.push(copy ? `${TASK_PAGES.list}/new?copy=${taskId}` : `${TASK_PAGES.list}/${taskId}`),
        addOn,
    };
}

export type AgendaCalendar = ReturnType<typeof useAgendaCalendar>;
