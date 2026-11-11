'use server'

/**
 * Agenda → Attività (list, task page, form), Calendario and Storico. Reading needs any Agenda page; creating and
 * changing tasks needs "modifica" on Attività or Da fare (deleting: also Calendario, and only the superadmin or the
 * task's creator). Every read also applies who may see which task.
 */

import { z } from 'zod';
import { APP_CONFIG } from '@/config/constants';
import { LINKS } from '@/config/navigation';
import { authorize } from '@/lib/auth/access';
import { canOpen } from '@/lib/auth/permissions';
import type { ClosedDay } from '@/lib/tasks/closedDays';
import { daysBetween, isIsoDate } from '@/lib/tasks/dates';
import { PrioritySchema, TaskInputSchema, inputProblem } from '@/lib/tasks/input';
import { listContacts } from '@/lib/tasks/db/contacts';
import { listGuides } from '@/lib/tasks/db/guides';
import { searchAgenda, type SearchHit } from '@/lib/tasks/db/search';
import { refreshSeries } from '@/lib/tasks/db/series';
import { listAreas, listClosedDays } from '@/lib/tasks/db/settings';
import { NotFound, loadGroupNames, loadPeople, personKey, today } from '@/lib/tasks/db/shared';
import { deleteTask, getTask, insertTask, listTasks, updateTask, updateTaskNotes, updateTaskPriority, updateTaskState } from '@/lib/tasks/db/tasks';
import { getDayLoads, getHistory, getRange, getTaskPage, type HistoryRow, type RangeData, type TaskPageData } from '@/lib/tasks/db/views';
import { OCCURRENCE_STATUSES, TASK_STATES, type Contact, type DayLoad, type GuideSummary, type NamedItem, type Person, type TaskDetail, type TaskInput, type TaskSummary } from '@/lib/tasks/types';
import { attempt, refused, type Result, type Saved } from '@/app/tasks/results';
import { APP_COPY } from '@/locales';

const ALL_PAGES = Object.values(LINKS.tasks);
const EDIT_PAGES = [LINKS.tasks.list, LINKS.tasks.todo];

const IdSchema = z.number().int().positive();
const VersionSchema = z.string().regex(/^0x[0-9A-Fa-f]{16}$/);

/** What the task form and the task page choose from or show names of */
export interface TaskOptions {
    today: string;
    /** The person filling the form (default responsible) */
    me: string;
    areas: NamedItem[];
    /** People who can be made responsible (suspended users left out) */
    people: Person[];
    groups: NamedItem[];
    guides: GuideSummary[];
    contacts: Contact[];
    closedDays: ClosedDay[];
}

async function taskOptions(me: string): Promise<TaskOptions> {
    const [areas, people, groups, guides, contacts, closedDays] = await Promise.all([
        listAreas(),
        loadPeople(),
        loadGroupNames(),
        listGuides(),
        listContacts(),
        listClosedDays(),
    ]);
    return {
        today: today(),
        me,
        areas,
        people: people.filter((person) => !person.suspended).map(({ key, name }) => ({ key, name })),
        groups,
        guides,
        contacts,
        closedDays,
    };
}

export async function getTaskListAction(): Promise<Result<{ tasks: TaskSummary[]; areas: NamedItem[]; people: Person[] }>> {
    const access = await authorize('view', ...ALL_PAGES);
    return attempt('task list', async () => {
        await refreshSeries();
        const [people, areas] = await Promise.all([loadPeople(), listAreas()]);
        return { tasks: await listTasks(access, people), areas, people: people.map(({ key, name }) => ({ key, name })) };
    });
}

/** The task page: the task, its occurrences, next dates and log, with the names it needs */
export async function getTaskPageAction(id: number): Promise<Result<{ data: TaskPageData; options: TaskOptions }>> {
    const access = await authorize('view', ...ALL_PAGES);
    if (!IdSchema.safeParse(id).success) return refused();
    return attempt('task page', async () => {
        const data = await getTaskPage(access, id, await loadPeople());
        if (!data) throw new NotFound();
        return { data, options: await taskOptions(personKey(access)) };
    });
}

/** The form: the task to change (or to copy for "Duplica"), null for a new one, and the choices */
export async function getTaskFormAction(id: number | null): Promise<Result<{ task: TaskDetail | null; options: TaskOptions }>> {
    const access = await authorize('view', ...ALL_PAGES);
    if (id !== null && !IdSchema.safeParse(id).success) return refused();
    return attempt('task form', async () => {
        const task = id === null ? null : await getTask(access, id, await loadPeople());
        if (id !== null && !task) throw new NotFound();
        return { task, options: await taskOptions(personKey(access)) };
    });
}

/** Creates (id null) or changes a task; answers its id */
export async function saveTaskAction(id: number | null, input: TaskInput, version: string | null): Promise<Result<{ id: number }>> {
    const access = await authorize('edit', ...EDIT_PAGES);
    const problem = inputProblem(TaskInputSchema, input);
    if (problem) return refused(problem);
    if (id !== null && (!IdSchema.safeParse(id).success || !VersionSchema.safeParse(version).success)) return refused();
    const clean = TaskInputSchema.parse(input) as TaskInput;

    return attempt('save task', async () => {
        const people = await loadPeople();
        if (clean.assignee !== null && !people.some((person) => person.key === clean.assignee)) throw new Error(APP_COPY.tasks.messages.invalidPerson);
        if (clean.visibility === 'group' && !(await loadGroupNames()).some((group) => group.id === clean.groupId)) throw new Error(APP_COPY.tasks.messages.invalidPerson);
        if (id === null) {
            const created = await insertTask(access, clean);
            await refreshSeries([created]);
            return { id: created };
        }
        const before = await getTask(access, id, people);
        if (!before) throw new NotFound();
        await updateTask(access, before, clean, version as string);
        await refreshSeries([id]);
        return { id };
    });
}

/** Only the instructions ("Come si fa"), changed in place on the task page or the calendar's side panel */
export async function saveTaskNotesAction(id: number, version: string, notes: string): Promise<Saved> {
    const access = await authorize('edit', ...EDIT_PAGES, LINKS.tasks.calendar);
    if (!IdSchema.safeParse(id).success || !VersionSchema.safeParse(version).success || !z.string().max(200_000).safeParse(notes).success) return refused();
    return attempt('task notes', async () => {
        const before = await getTask(access, id, await loadPeople());
        if (!before) throw new NotFound();
        await updateTaskNotes(access, id, version, notes);
        return {};
    });
}

/** Pause, archive, resume, restore */
export async function setTaskStateAction(id: number, version: string, state: string): Promise<Saved> {
    const access = await authorize('edit', ...EDIT_PAGES);
    const parsed = z.enum(TASK_STATES).safeParse(state);
    if (!IdSchema.safeParse(id).success || !VersionSchema.safeParse(version).success || !parsed.success) return refused();
    return attempt('task state', async () => {
        const before = await getTask(access, id, await loadPeople());
        if (!before) throw new NotFound();
        await updateTaskState(access, id, version, parsed.data, before.state);
        if (parsed.data === 'active') await refreshSeries([id]);
        return {};
    });
}

/** The Agenda search bar: tasks, procedures and contacts containing the text (each kind only if its page may be opened) */
export async function searchAgendaAction(text: string): Promise<Result<{ hits: SearchHit[] }>> {
    const access = await authorize('view', ...ALL_PAGES);
    const term = String(text ?? '').trim();
    if (term.length < APP_CONFIG.TASKS.SEARCH_MIN_CHARS || term.length > APP_CONFIG.TASKS.MAX_TITLE_LENGTH) return { success: true, hits: [] };
    const kinds = { task: canOpen(access, LINKS.tasks.list), guide: canOpen(access, LINKS.tasks.guides), contact: canOpen(access, LINKS.tasks.contacts) };
    return attempt('search', async () => ({ hits: await searchAgenda(access, term, kinds) }));
}

/** Only the priority of a task (calendar right-click) */
export async function setTaskPriorityAction(id: number, priority: number): Promise<Saved> {
    const access = await authorize('edit', ...EDIT_PAGES, LINKS.tasks.calendar);
    const parsed = PrioritySchema.safeParse(priority);
    if (!IdSchema.safeParse(id).success || !parsed.success) return refused();
    return attempt('task priority', async () => {
        if (!(await getTask(access, id, await loadPeople()))) throw new NotFound();
        await updateTaskPriority(access, id, parsed.data);
        return {};
    });
}

/** Deletes a task for good, with all its dates and history (the superadmin, or whoever created it) */
export async function deleteTaskAction(id: number): Promise<Saved> {
    const access = await authorize('edit', ...EDIT_PAGES, LINKS.tasks.calendar);
    if (!IdSchema.safeParse(id).success) return refused();
    return attempt('delete task', async () => {
        const task = await getTask(access, id, await loadPeople());
        if (!task) throw new NotFound();
        if (!task.deletable) throw new Error(APP_COPY.tasks.messages.deleteNotAllowed);
        await deleteTask(access, id, task.title);
        return {};
    });
}

/** A valid range of days: real dates, start not after end, at most `maxDays` long */
const validRange = (start: unknown, end: unknown, maxDays: number) =>
    isIsoDate(start) && isIsoDate(end) && start <= end && daysBetween(start, end) < maxDays;

/** The week or month view: occurrences, planned dates and closed days between two dates, and what is late */
export async function getRangeAction(start: string, end: string): Promise<Result<{ data: RangeData }>> {
    const access = await authorize('view', ...ALL_PAGES);
    if (!validRange(start, end, APP_CONFIG.TASKS.RANGE_MAX_DAYS)) return refused();
    return attempt('range', async () => ({ data: await getRange(access, start, end, await loadPeople()) }));
}

/** How full each day between two dates is (the strip of the coming weeks) */
export async function getDayLoadsAction(start: string, end: string): Promise<Result<{ loads: Record<string, DayLoad> }>> {
    const access = await authorize('view', ...ALL_PAGES);
    if (!validRange(start, end, APP_CONFIG.TASKS.LOAD_MAX_DAYS)) return refused();
    return attempt('day loads', async () => ({ loads: await getDayLoads(access, start, end) }));
}

/** Closed occurrences between two dates, with these outcomes */
export async function getHistoryAction(from: string, to: string, statuses: string[]): Promise<Result<{ rows: HistoryRow[] }>> {
    const access = await authorize('view', LINKS.tasks.history);
    const parsed = z.array(z.enum(OCCURRENCE_STATUSES)).min(1).max(OCCURRENCE_STATUSES.length).safeParse(statuses);
    if (!isIsoDate(from) || !isIsoDate(to) || from > to || !parsed.success) return refused();
    return attempt('history', async () => ({ rows: await getHistory(access, from, to, parsed.data, await loadPeople()) }));
}
