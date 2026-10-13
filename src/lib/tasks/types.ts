/**
 * Agenda types shared by the server (src/lib/tasks/db, src/app/tasks/*-actions.ts) and the screens (src/components/tasks).
 * Words: a task (attività) is the thing to do; an occurrence (scadenza) is one real moment it is due.
 */

import type { RepeatRule } from '@/lib/tasks/repeat';

export const TASK_STATES = ['active', 'paused', 'archived'] as const;
export type TaskState = (typeof TASK_STATES)[number];

/** 0 normale · 1 alta · 2 critica (fines or penalties when missed) */
export const PRIORITIES = [0, 1, 2] as const;
export type Priority = (typeof PRIORITIES)[number];

/** private: the person responsible and who created it · group: also that group · all: everyone who opens the Agenda */
export const VISIBILITIES = ['private', 'group', 'all'] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const OCCURRENCE_STATUSES = ['open', 'progress', 'waiting', 'done', 'skipped', 'cancelled', 'replaced'] as const;
export type OccurrenceStatus = (typeof OCCURRENCE_STATUSES)[number];

/** Still to be done: shown in "Da fare" */
export const OPEN_STATUSES = ['open', 'progress', 'waiting'] as const satisfies readonly OccurrenceStatus[];
export const isOpenStatus = (status: OccurrenceStatus) => (OPEN_STATUSES as readonly OccurrenceStatus[]).includes(status);

export const LINK_KINDS = ['web', 'path', 'page', 'email', 'phone', 'other'] as const;
export type LinkKind = (typeof LINK_KINDS)[number];

/** A person as the login names them: an app_users id as text ('12') or 'superadmin' */
export type PersonKey = string;

export interface Person {
    key: PersonKey;
    name: string;
}

export interface NamedItem {
    id: number;
    name: string;
}

export interface TaskLink {
    label: string;
    kind: LinkKind;
    value: string;
}

/** One step of a task's checklist; the id stays when the text changes, so ticks stay on the right step */
export interface ChecklistItem {
    id: string;
    text: string;
}

/** The fields a task is created or changed with (the form) */
export interface TaskInput {
    title: string;
    notes: string;
    areaId: number | null;
    tags: string[];
    priority: Priority;
    assignee: PersonKey | null;
    groupId: number | null;
    visibility: Visibility;
    /** One-time: the due date (null = no date) · repeating: the first date */
    dueDate: string | null;
    /** HH:MM, or null */
    dueTime: string | null;
    repeat: RepeatRule | null;
    showDays: number;
    checklist: ChecklistItem[];
    estimateMinutes: number | null;
    links: TaskLink[];
    guideIds: number[];
    contactIds: number[];
}

/** A task in a list (Attività) */
export interface TaskSummary {
    id: number;
    title: string;
    areaId: number | null;
    areaName: string | null;
    tags: string[];
    priority: Priority;
    assignee: PersonKey | null;
    assigneeName: string | null;
    state: TaskState;
    dueDate: string | null;
    dueTime: string | null;
    repeat: RepeatRule | null;
    /** Earliest open occurrence */
    nextDue: string | null;
    openCount: number;
    /** Date of the last occurrence done */
    lastDone: string | null;
}

/** A task with everything it holds (detail page, edit form) */
export interface TaskDetail extends TaskSummary, Omit<TaskInput, 'title' | 'areaId' | 'tags' | 'priority' | 'assignee' | 'dueDate' | 'dueTime' | 'repeat'> {
    createdAt: string;
    createdBy: string;
    updatedAt: string;
    updatedBy: string;
    /** Version stamp: a save with an older one is refused (changed by someone else meanwhile) */
    version: string;
    /** The person may delete it for good: the superadmin, or whoever created it */
    deletable: boolean;
}

/** One occurrence (scadenza) */
export interface Occurrence {
    id: number;
    taskId: number;
    originalDate: string | null;
    dueDate: string | null;
    dueTime: string | null;
    status: OccurrenceStatus;
    statusNote: string | null;
    outcome: string | null;
    /** Ids of the checklist steps ticked */
    checklistDone: string[];
    /** "YYYY-MM-DD HH:MM:SS", server wall-clock time */
    doneAt: string | null;
    doneByName: string | null;
    /** Its place among the open ones due the same day (1 = first) when put there by hand; null = by time and priority */
    dayOrder: number | null;
    version: string;
}

/** An open occurrence with what the to-do list shows of its task */
export interface AgendaItem extends Occurrence {
    title: string;
    priority: Priority;
    areaName: string | null;
    assigneeName: string | null;
    repeats: boolean;
    showDays: number;
    checklistCount: number;
    estimateMinutes: number | null;
    /** The working day before, when the due date falls on a closed day */
    suggestedDate: string | null;
    /** Why the due date is a closed day (holiday name, "weekend") */
    closedReason: string | null;
    /** How many times this occurrence was postponed ("Rimanda", or dragged to another day) */
    postponedCount: number;
    /** The person may delete its task for good (see TaskDetail.deletable) */
    deletable: boolean;
}

/** An entry of a task's history (tsk_log) */
export interface LogEntry {
    id: number;
    /** "YYYY-MM-DD HH:MM:SS" */
    at: string;
    personName: string;
    action: string;
    occurrenceId: number | null;
    details: Record<string, unknown> | null;
}

export const GUIDE_STATES = ['active', 'archived'] as const;
export type GuideState = (typeof GUIDE_STATES)[number];

/** A procedure in the list */
export interface GuideSummary {
    id: number;
    title: string;
    areaId: number | null;
    areaName: string | null;
    state: GuideState;
    /** "YYYY-MM-DD HH:MM:SS" */
    updatedAt: string;
    reviewMonths: number | null;
    reviewedAt: string | null;
    /** Its review is due ("da ricontrollare") */
    toReview: boolean;
    taskCount: number;
}

/** A procedure with everything it holds */
export interface GuideDetail extends GuideSummary {
    body: string;
    links: TaskLink[];
    contactIds: number[];
    createdAt: string;
    createdBy: string;
    updatedBy: string;
    version: string;
    /** Tasks that use it (the ones the person may see) */
    tasks: { id: number; title: string; state: TaskState }[];
    versions: { id: number; savedAt: string; savedBy: string }[];
}

export interface GuideVersion {
    id: number;
    title: string;
    body: string;
    savedAt: string;
    savedBy: string;
}

export interface Contact {
    id: number;
    name: string;
    company: string;
    role: string;
    phone: string;
    email: string;
    notes: string;
    state: GuideState;
    taskCount: number;
    guideCount: number;
    version: string;
}

/** A date a repeating task will have, not stored yet (calendar) */
export interface PlannedEntry {
    taskId: number;
    title: string;
    date: string;
    time: string | null;
    priority: Priority;
    areaName: string | null;
    /** Who is responsible (the calendar's person filter) */
    assignee: PersonKey | null;
}

/** How full a day is: things due (stored and planned) and how many of them are critical */
export interface DayLoad {
    count: number;
    critical: number;
}
