/**
 * What each Agenda page reads, in one call each: the to-do list, a task's page, a range of days (week and month
 * views), how full the coming days are, the history.
 * Server only; the person's visibility applies to every list.
 */

import { APP_CONFIG } from '@/config/constants';
import type { UserAccess } from '@/lib/auth/permissions';
import type { SqlParams } from '@/lib/mssql';
import { agendaGroup, type AgendaGroup } from '@/lib/tasks/agenda';
import { closedDayChecker, type ClosedDayChecker } from '@/lib/tasks/closedDays';
import { addDays, maxDate } from '@/lib/dateUtils';
import { plannedDates, upcomingDates } from '@/lib/tasks/projection';
import { addInterval, parseRepeatRule } from '@/lib/tasks/repeat';
import type { AgendaItem, DayLoad, LogEntry, NamedItem, Occurrence, OccurrenceStatus, Person, PlannedEntry, Priority, TaskDetail } from '@/lib/tasks/types';
import { refreshSeries } from '@/lib/tasks/db/series';
import { listAreas, listClosedDays } from '@/lib/tasks/db/settings';
import { OPEN_LIST, getTask } from '@/lib/tasks/db/tasks';
import { DATE_SQL, MOMENT_SQL, TIME_SQL, VERSION_SQL, mayDelete, nameResolver, parseJson, rows, today as todayDate, visibleTasksSql } from '@/lib/tasks/db/shared';

interface OccurrenceRow {
    id: number;
    task_id: number;
    original_date: string | null;
    due_date: string | null;
    due_time: string | null;
    status: OccurrenceStatus;
    status_note: string | null;
    outcome: string | null;
    checklist_done: string | null;
    done_at: string | null;
    done_by: string | null;
    day_order: number | null;
    version: string;
}

interface AgendaRow extends OccurrenceRow {
    title: string;
    priority: Priority;
    area_name: string | null;
    assignee: string | null;
    repeats: number;
    show_days: number;
    checklist: string | null;
    estimate_minutes: number | null;
    created_by: string;
    postponed: number;
}

const OCCURRENCE_COLUMNS = `o.id, o.task_id, ${DATE_SQL('o.original_date')} AS original_date, ${DATE_SQL('o.due_date')} AS due_date,
    ${TIME_SQL('o.due_time')} AS due_time, o.status, o.status_note, o.outcome, o.checklist_done,
    ${MOMENT_SQL('o.done_at')} AS done_at, o.done_by, o.day_order, ${VERSION_SQL('o.row_version')} AS version`;

function toOccurrence(row: OccurrenceRow, nameOf: (key: string | null) => string | null): Occurrence {
    return {
        id: row.id,
        taskId: row.task_id,
        originalDate: row.original_date,
        dueDate: row.due_date,
        dueTime: row.due_time,
        status: row.status,
        statusNote: row.status_note,
        outcome: row.outcome,
        checklistDone: parseJson<string[]>(row.checklist_done, []),
        doneAt: row.done_at,
        doneByName: nameOf(row.done_by),
        dayOrder: row.day_order,
        version: row.version,
    };
}

/** The working day to suggest when a due date is a closed day */
function closedInfo(checker: ClosedDayChecker, dueDate: string | null): { suggestedDate: string | null; closedReason: string | null } {
    const reason = dueDate ? checker.reason(dueDate) : null;
    return reason && dueDate ? { suggestedDate: checker.workingDayOnOrBefore(dueDate), closedReason: reason } : { suggestedDate: null, closedReason: null };
}

export interface AgendaData {
    today: string;
    /** Open occurrences of the person's active tasks */
    items: AgendaItem[];
    /** Done today, newest first (to see and undo) */
    doneToday: AgendaItem[];
    areas: NamedItem[];
    /** People responsible for something in the list (the person filter) */
    people: Person[];
}

const AGENDA_SELECT = `SELECT ${OCCURRENCE_COLUMNS}, t.title, t.priority, a.name AS area_name, t.assignee,
        CASE WHEN t.repeat_rule IS NULL THEN 0 ELSE 1 END AS repeats, t.show_days, t.checklist, t.estimate_minutes, t.created_by,
        (SELECT COUNT(*) FROM tsk_log l WITH (NOLOCK) WHERE l.entity_kind = 'occurrence' AND l.entity_id = o.id AND l.action = 'postponed') AS postponed
    FROM tsk_occurrences o WITH (NOLOCK)
    JOIN tsk_tasks t WITH (NOLOCK) ON t.id = o.task_id
    LEFT JOIN tsk_areas a WITH (NOLOCK) ON a.id = t.area_id`;

/**
 * Occurrences with what the lists show of their task, for the person: `where` is the extra condition (with its
 * parameters in `params`). Each gets the working day to suggest when it falls on a closed day.
 */
async function loadItems(
    access: UserAccess,
    where: string,
    params: SqlParams,
    people: Person[],
    checker: ClosedDayChecker
): Promise<{ items: AgendaItem[]; assignees: Set<string> }> {
    const list = await rows<AgendaRow>(
        `${AGENDA_SELECT} WHERE ${visibleTasksSql(access, params)} AND ${where} ORDER BY o.due_date, o.due_time, t.priority DESC, t.title`,
        params
    );
    const nameOf = nameResolver(people);
    const items = list.map((row) => ({
        ...toOccurrence(row, nameOf),
        title: row.title,
        priority: row.priority,
        areaName: row.area_name,
        assigneeName: nameOf(row.assignee),
        repeats: row.repeats === 1,
        showDays: row.show_days,
        checklistCount: parseJson<unknown[]>(row.checklist, []).length,
        estimateMinutes: row.estimate_minutes,
        ...closedInfo(checker, row.status === 'done' ? null : row.due_date),
        postponedCount: row.postponed,
        deletable: mayDelete(access, row.created_by),
    }));
    return { items, assignees: new Set(list.map((row) => row.assignee).filter((key): key is string => key !== null)) };
}

/** The to-do list: makes the due occurrences of repeating tasks first, then reads */
export async function getAgenda(access: UserAccess, people: Person[]): Promise<AgendaData> {
    await refreshSeries();
    const today = todayDate();
    const [areas, closedDays] = await Promise.all([listAreas(), listClosedDays()]);
    const { items: list, assignees } = await loadItems(
        access,
        `t.state = 'active' AND (o.status IN (${OPEN_LIST}) OR (o.status = 'done' AND o.done_at >= @today))`,
        { today },
        people,
        closedDayChecker(closedDays)
    );
    const items = list.filter((item) => item.status !== 'done');
    const doneToday = list
        .filter((item) => item.status === 'done')
        .sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''))
        .slice(0, APP_CONFIG.TASKS.DONE_TODAY_LIMIT);
    return { today, items, doneToday, areas, people: people.filter((person) => assignees.has(person.key)) };
}

/** How many open occurrences fall in each group (home page) */
export async function agendaCounts(access: UserAccess, people: Person[]): Promise<Record<AgendaGroup, number>> {
    const { items, today } = await getAgenda(access, people);
    const counts: Record<AgendaGroup, number> = { overdue: 0, today: 0, soon: 0, later: 0, nodate: 0 };
    for (const item of items) counts[agendaGroup(item, today)]++;
    return counts;
}

export interface TaskPageData {
    today: string;
    task: TaskDetail;
    /** All its occurrences, open ones first, each with the suggested day when it falls on a closed day */
    occurrences: (Occurrence & { suggestedDate: string | null; closedReason: string | null })[];
    /** Dates the rule will give next (not stored yet) */
    nextDates: string[];
    log: LogEntry[];
}

interface LogRow {
    id: number;
    at: string;
    person: string;
    entity_kind: string;
    entity_id: number;
    action: string;
    details: string | null;
}

export async function getTaskPage(access: UserAccess, id: number, people: Person[]): Promise<TaskPageData | null> {
    await refreshSeries([id]);
    const task = await getTask(access, id, people);
    if (!task) return null;
    const [occurrences, log, closedDays, series] = await Promise.all([
        rows<OccurrenceRow>(
            `SELECT ${OCCURRENCE_COLUMNS} FROM tsk_occurrences o WITH (NOLOCK) WHERE o.task_id = @id
             ORDER BY CASE WHEN o.status IN (${OPEN_LIST}) THEN 0 ELSE 1 END,
                      CASE WHEN o.status IN (${OPEN_LIST}) THEN o.due_date END, o.due_date DESC, o.id DESC`,
            { id }
        ),
        rows<LogRow>(
            `SELECT TOP 300 id, ${MOMENT_SQL('logged_at')} AS at, person, entity_kind, entity_id, action, details
             FROM tsk_log WITH (NOLOCK) WHERE task_id = @id ORDER BY id DESC`,
            { id }
        ),
        listClosedDays(),
        rows<{ made: number; latest: string | null; repeat_from: string | null }>(
            `SELECT COUNT(o.id) AS made, ${DATE_SQL('MAX(o.original_date)')} AS latest, ${DATE_SQL('MAX(t.repeat_from)')} AS repeat_from
             FROM tsk_tasks t WITH (NOLOCK) LEFT JOIN tsk_occurrences o WITH (NOLOCK) ON o.task_id = t.id WHERE t.id = @id`,
            { id }
        ),
    ]);
    const today = todayDate();
    const checker = closedDayChecker(closedDays);
    const nameOf = nameResolver(people);

    let nextDates: string[] = [];
    const { made, latest, repeat_from: repeatFrom } = series[0] ?? { made: 0, latest: null, repeat_from: null };
    const rule = task.state === 'active' ? task.repeat : null;
    if (rule && task.dueDate) {
        const count = APP_CONFIG.TASKS.NEXT_DATES_PREVIEW;
        if (rule.mode === 'calendar') {
            const from = [today, repeatFrom ?? today, latest ? addDays(latest, 1) : today].reduce(maxDate);
            nextDates = upcomingDates(rule, task.dueDate, from, count, made);
        } else {
            // After the open one, if each is done on its day
            const base = task.nextDue ?? latest;
            const first = base ? addInterval(base, rule.every, rule.unit) : null;
            nextDates = first ? upcomingDates(rule, first, first, count, made) : [];
        }
    }

    return {
        today,
        task,
        occurrences: occurrences.map((row) => ({ ...toOccurrence(row, nameOf), ...closedInfo(checker, row.status === 'done' ? null : row.due_date) })),
        nextDates,
        log: log.map((row) => ({
            id: row.id,
            at: row.at,
            personName: nameOf(row.person) ?? '',
            action: row.action,
            occurrenceId: row.entity_kind === 'occurrence' ? row.entity_id : null,
            details: parseJson<Record<string, unknown> | null>(row.details, null),
        })),
    };
}

export interface RangeData {
    today: string;
    start: string;
    end: string;
    /** Occurrences due between start and end (not replaced ones; tasks not archived) */
    items: AgendaItem[];
    /** Open occurrences already late (any date before today), for the week view's dock */
    overdue: AgendaItem[];
    /** Open occurrences without a date ("Senza data"), to drag onto a day */
    undated: AgendaItem[];
    /** Dates repeating tasks will have between start and end, not stored yet */
    planned: PlannedEntry[];
    /** Closed days in the range: date → reason */
    closed: Record<string, string>;
    /** The filters: all areas, and the people responsible for something shown */
    areas: NamedItem[];
    people: Person[];
}

interface SeriesRow {
    id: number;
    title: string;
    priority: Priority;
    area_name: string | null;
    assignee: string | null;
    due_time: string | null;
    repeat_rule: string;
    anchor: string;
    repeat_from: string;
    made: number;
    latest: string | null;
    open_due: string | null;
}

/** The dates the person's active repeating tasks will have between start and end that are not stored yet */
async function plannedBetween(access: UserAccess, start: string, end: string): Promise<PlannedEntry[]> {
    const params: SqlParams = {};
    const series = await rows<SeriesRow>(
        `SELECT t.id, t.title, t.priority, a.name AS area_name, t.assignee, ${TIME_SQL('t.due_time')} AS due_time, t.repeat_rule,
                ${DATE_SQL('t.due_date')} AS anchor, ${DATE_SQL('COALESCE(t.repeat_from, CAST(t.created_at AS date))')} AS repeat_from,
                (SELECT COUNT(*) FROM tsk_occurrences o WITH (NOLOCK) WHERE o.task_id = t.id) AS made,
                (SELECT ${DATE_SQL('MAX(o.original_date)')} FROM tsk_occurrences o WITH (NOLOCK) WHERE o.task_id = t.id) AS latest,
                (SELECT ${DATE_SQL('MAX(o.due_date)')} FROM tsk_occurrences o WITH (NOLOCK) WHERE o.task_id = t.id AND o.status IN (${OPEN_LIST})) AS open_due
         FROM tsk_tasks t WITH (NOLOCK)
         LEFT JOIN tsk_areas a WITH (NOLOCK) ON a.id = t.area_id
         WHERE t.state = 'active' AND t.repeat_rule IS NOT NULL AND t.due_date IS NOT NULL AND ${visibleTasksSql(access, params)}`,
        params
    );
    const planned: PlannedEntry[] = [];
    for (const task of series) {
        const rule = parseRepeatRule(task.repeat_rule);
        if (!rule) continue;
        const stored = { anchor: task.anchor, repeatFrom: task.repeat_from, made: task.made, latestDate: task.latest, openDue: task.open_due };
        for (const date of plannedDates(rule, stored, start, end)) {
            planned.push({ taskId: task.id, title: task.title, date, time: task.due_time, priority: task.priority, areaName: task.area_name, assignee: task.assignee });
        }
    }
    return planned.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? '') || a.title.localeCompare(b.title));
}

/** A stretch of days (a week, a month grid): its occurrences, the planned dates, the closed days, and what is late */
export async function getRange(access: UserAccess, start: string, end: string, people: Person[]): Promise<RangeData> {
    await refreshSeries();
    const today = todayDate();
    const [closedDays, areas] = await Promise.all([listClosedDays(), listAreas()]);
    const checker = closedDayChecker(closedDays);
    const [inRange, late, undated, planned] = await Promise.all([
        loadItems(access, `t.state <> 'archived' AND o.status <> 'replaced' AND o.due_date BETWEEN @start AND @end`, { start, end }, people, checker),
        loadItems(access, `t.state = 'active' AND o.status IN (${OPEN_LIST}) AND o.due_date < @today`, { today }, people, checker),
        loadItems(access, `t.state = 'active' AND o.status IN (${OPEN_LIST}) AND o.due_date IS NULL`, {}, people, checker),
        plannedBetween(access, start, end),
    ]);
    const closed: Record<string, string> = {};
    for (let day = start; day <= end; day = addDays(day, 1)) {
        const reason = checker.reason(day);
        if (reason) closed[day] = reason;
    }
    const assignees = new Set([...Array.from(inRange.assignees), ...Array.from(late.assignees), ...Array.from(undated.assignees), ...planned.map((entry) => entry.assignee)]);
    return {
        today,
        start,
        end,
        items: inRange.items,
        overdue: late.items,
        undated: undated.items,
        planned,
        closed,
        areas,
        people: people.filter((person) => assignees.has(person.key)).map(({ key, name }) => ({ key, name })),
    };
}

/** How full each day between start and end is: stored occurrences still counting, plus planned dates */
export async function getDayLoads(access: UserAccess, start: string, end: string): Promise<Record<string, DayLoad>> {
    await refreshSeries();
    const params: SqlParams = { start, end };
    const [stored, planned] = await Promise.all([
        rows<{ day: string; count: number; critical: number }>(
            `SELECT ${DATE_SQL('o.due_date')} AS day, COUNT(*) AS count, SUM(CASE WHEN t.priority = 2 THEN 1 ELSE 0 END) AS critical
             FROM tsk_occurrences o WITH (NOLOCK) JOIN tsk_tasks t WITH (NOLOCK) ON t.id = o.task_id
             WHERE t.state <> 'archived' AND o.status NOT IN ('replaced', 'skipped', 'cancelled')
               AND o.due_date BETWEEN @start AND @end AND ${visibleTasksSql(access, params)}
             GROUP BY o.due_date`,
            params
        ),
        plannedBetween(access, start, end),
    ]);
    const loads: Record<string, DayLoad> = {};
    for (const row of stored) loads[row.day] = { count: row.count, critical: row.critical };
    for (const entry of planned) {
        const load = loads[entry.date] ?? { count: 0, critical: 0 };
        loads[entry.date] = { count: load.count + 1, critical: load.critical + (entry.priority === 2 ? 1 : 0) };
    }
    return loads;
}

export interface HistoryRow {
    occurrenceId: number;
    taskId: number;
    title: string;
    areaName: string | null;
    originalDate: string | null;
    dueDate: string | null;
    status: OccurrenceStatus;
    /** "YYYY-MM-DD HH:MM:SS" */
    closedAt: string;
    closedBy: string | null;
    note: string | null;
}

/** Closed occurrences (done, skipped, cancelled, replaced) closed between two dates, newest first */
export async function getHistory(access: UserAccess, from: string, to: string, statuses: OccurrenceStatus[], people: Person[]): Promise<HistoryRow[]> {
    const params: SqlParams = { from, to, statuses: statuses.join(','), limit: APP_CONFIG.TASKS.HISTORY_LIMIT };
    const list = await rows<{
        id: number;
        task_id: number;
        title: string;
        area_name: string | null;
        original_date: string | null;
        due_date: string | null;
        status: OccurrenceStatus;
        closed_at: string;
        closed_by: string | null;
        outcome: string | null;
        status_note: string | null;
    }>(
        `SELECT TOP (@limit) o.id, o.task_id, t.title, a.name AS area_name, ${DATE_SQL('o.original_date')} AS original_date,
                ${DATE_SQL('o.due_date')} AS due_date, o.status, ${MOMENT_SQL('COALESCE(o.done_at, o.updated_at)')} AS closed_at,
                COALESCE(o.done_by, o.updated_by) AS closed_by, o.outcome, o.status_note
         FROM tsk_occurrences o WITH (NOLOCK)
         JOIN tsk_tasks t WITH (NOLOCK) ON t.id = o.task_id
         LEFT JOIN tsk_areas a WITH (NOLOCK) ON a.id = t.area_id
         WHERE o.status IN (SELECT value FROM STRING_SPLIT(@statuses, ','))
           AND CAST(COALESCE(o.done_at, o.updated_at) AS date) BETWEEN @from AND @to
           AND ${visibleTasksSql(access, params)}
         ORDER BY COALESCE(o.done_at, o.updated_at) DESC, o.id DESC`,
        params
    );
    const nameOf = nameResolver(people);
    return list.map((row) => ({
        occurrenceId: row.id,
        taskId: row.task_id,
        title: row.title,
        areaName: row.area_name,
        originalDate: row.original_date,
        dueDate: row.due_date,
        status: row.status,
        closedAt: row.closed_at,
        closedBy: nameOf(row.closed_by),
        note: row.outcome ?? row.status_note,
    }));
}
