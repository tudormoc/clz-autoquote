/**
 * The task form's state (what the fields hold, as typed) and its conversion to and from a task.
 * Pure, used by useTaskForm; the result is checked again on the server (TaskInputSchema).
 */

import { APP_CONFIG } from '@/config/constants';
import { dayOf, monthOf, weekdayOf } from '@/lib/tasks/dates';
import { TaskInputSchema, inputProblem, parseTags } from '@/lib/tasks/input';
import { isFilledLink } from '@/lib/tasks/links';
import type { IntervalUnit, MonthDay, RepeatEnd, RepeatRule } from '@/lib/tasks/repeat';
import type { ChecklistItem, Priority, TaskDetail, TaskInput, TaskLink, Visibility } from '@/lib/tasks/types';

export type Nth = 1 | 2 | 3 | 4 | -1;

/** The repeat part of the form */
export interface RepeatDraft {
    mode: 'calendar' | 'after';
    every: string;
    unit: IntervalUnit;
    weekdays: number[];
    monthOn: MonthDay['type'];
    /** "16" or "1, 15" */
    monthDays: string;
    nth: Nth;
    weekday: number;
    yearDates: { month: number; day: number }[];
    missed: 'keep' | 'latest';
    end: RepeatEnd['type'];
    until: string;
    count: string;
}

export interface TaskDraft {
    title: string;
    notes: string;
    /** '' = no area */
    areaId: string;
    /** As typed, comma-separated */
    tags: string;
    priority: Priority;
    /** '' = nobody in particular */
    assignee: string;
    visibility: Visibility;
    groupId: string;
    kind: 'once' | 'repeat';
    /** YYYY-MM-DD or '' */
    dueDate: string;
    /** HH:MM or '' */
    dueTime: string;
    repeat: RepeatDraft;
    showDays: string;
    checklist: ChecklistItem[];
    estimate: string;
    links: TaskLink[];
    guideIds: number[];
    contactIds: number[];
}

/** Repeat fields that fit a first date: its weekday, its day of the month, its day and month */
export function repeatDraftFor(date: string): RepeatDraft {
    return {
        mode: 'calendar',
        every: '1',
        unit: 'months',
        weekdays: [weekdayOf(date)],
        monthOn: 'days',
        monthDays: String(dayOf(date)),
        nth: 1,
        weekday: weekdayOf(date),
        yearDates: [{ month: monthOf(date), day: dayOf(date) }],
        missed: 'keep',
        end: 'never',
        until: '',
        count: '',
    };
}

const toNumber = (text: string) => (/^\d+$/.test(text.trim()) ? Number(text.trim()) : NaN);

/** "1, 15 ,31" → [1, 15, 31] (anything else left out, so the check reports an empty list) */
export const parseMonthDays = (text: string) =>
    text
        .split(/[,\s;]+/)
        .map(toNumber)
        .filter((day) => Number.isInteger(day) && day >= 1 && day <= 31);

function toEnd(draft: RepeatDraft): RepeatEnd {
    if (draft.end === 'until') return { type: 'until', date: draft.until };
    if (draft.end === 'count') return { type: 'count', count: toNumber(draft.count) };
    return { type: 'never' };
}

/** The repeat fields as a rule (not checked yet: TaskInputSchema does that) */
export function toRepeatRule(draft: RepeatDraft): RepeatRule {
    const every = toNumber(draft.every);
    const end = toEnd(draft);
    if (draft.mode === 'after') return { mode: 'after', every, unit: draft.unit, end };
    const on: MonthDay =
        draft.monthOn === 'last'
            ? { type: 'last' }
            : draft.monthOn === 'weekday'
              ? { type: 'weekday', nth: draft.nth, weekday: draft.weekday }
              : { type: 'days', days: parseMonthDays(draft.monthDays) };
    const pattern =
        draft.unit === 'days'
            ? { unit: 'days' as const, every }
            : draft.unit === 'weeks'
              ? { unit: 'weeks' as const, every, weekdays: draft.weekdays }
              : draft.unit === 'months'
                ? { unit: 'months' as const, every, on }
                : { unit: 'years' as const, every, dates: draft.yearDates };
    return { mode: 'calendar', pattern, missed: draft.missed, end };
}

/** A stored rule back into the fields */
export function fromRepeatRule(rule: RepeatRule, firstDate: string): RepeatDraft {
    const base = repeatDraftFor(firstDate);
    const end = { end: rule.end.type, until: rule.end.type === 'until' ? rule.end.date : '', count: rule.end.type === 'count' ? String(rule.end.count) : '' };
    if (rule.mode === 'after') return { ...base, ...end, mode: 'after', every: String(rule.every), unit: rule.unit };
    const { pattern } = rule;
    const draft: RepeatDraft = { ...base, ...end, mode: 'calendar', missed: rule.missed, every: String(pattern.every), unit: pattern.unit };
    if (pattern.unit === 'weeks') draft.weekdays = pattern.weekdays;
    if (pattern.unit === 'years') draft.yearDates = pattern.dates;
    if (pattern.unit === 'months') {
        draft.monthOn = pattern.on.type;
        if (pattern.on.type === 'days') draft.monthDays = pattern.on.days.join(', ');
        if (pattern.on.type === 'weekday') {
            draft.nth = pattern.on.nth;
            draft.weekday = pattern.on.weekday;
        }
    }
    return draft;
}

/** A new task: the person's own, private, one-time, no date yet */
export function emptyTaskDraft(me: string, today: string): TaskDraft {
    return {
        title: '',
        notes: '',
        areaId: '',
        tags: '',
        priority: 0,
        assignee: me,
        visibility: 'private',
        groupId: '',
        kind: 'once',
        dueDate: '',
        dueTime: '',
        repeat: repeatDraftFor(today),
        showDays: String(APP_CONFIG.TASKS.DEFAULT_SHOW_DAYS),
        checklist: [],
        estimate: '',
        links: [],
        guideIds: [],
        contactIds: [],
    };
}

/** A stored task into the fields (for "Modifica", or "Duplica" with a new title) */
export function taskDraftFrom(task: TaskDetail, today: string): TaskDraft {
    return {
        title: task.title,
        notes: task.notes,
        areaId: task.areaId ? String(task.areaId) : '',
        tags: task.tags.join(', '),
        priority: task.priority,
        assignee: task.assignee ?? '',
        visibility: task.visibility,
        groupId: task.groupId ? String(task.groupId) : '',
        kind: task.repeat ? 'repeat' : 'once',
        dueDate: task.dueDate ?? '',
        dueTime: task.dueTime ?? '',
        repeat: task.repeat ? fromRepeatRule(task.repeat, task.dueDate ?? today) : repeatDraftFor(task.dueDate ?? today),
        showDays: String(task.showDays),
        checklist: task.checklist,
        estimate: task.estimateMinutes ? String(task.estimateMinutes) : '',
        links: task.links,
        guideIds: task.guideIds,
        contactIds: task.contactIds,
    };
}

/** The fields as a task to save, or the first problem as a text for the user */
export function toTaskInput(draft: TaskDraft): { input: TaskInput } | { error: string } {
    const estimate = toNumber(draft.estimate);
    const input: TaskInput = {
        title: draft.title.trim(),
        notes: draft.notes,
        areaId: draft.areaId ? Number(draft.areaId) : null,
        tags: parseTags(draft.tags),
        priority: draft.priority,
        assignee: draft.assignee || null,
        groupId: draft.visibility === 'group' && draft.groupId ? Number(draft.groupId) : null,
        visibility: draft.visibility,
        dueDate: draft.dueDate || null,
        dueTime: draft.dueTime || null,
        repeat: draft.kind === 'repeat' ? toRepeatRule(draft.repeat) : null,
        showDays: toNumber(draft.showDays),
        checklist: draft.checklist.map((item) => ({ ...item, text: item.text.trim() })).filter((item) => item.text.length > 0),
        estimateMinutes: Number.isInteger(estimate) && estimate > 0 ? estimate : null,
        links: draft.links.filter(isFilledLink).map((link) => ({ ...link, label: link.label.trim(), value: link.value.trim() })),
        guideIds: draft.guideIds,
        contactIds: draft.contactIds,
    };
    const problem = inputProblem(TaskInputSchema, input);
    return problem ? { error: problem } : { input };
}

/** A new checklist step id (stays with the step when its text changes) */
export const newStepId = () => Math.random().toString(36).slice(2, 10);
