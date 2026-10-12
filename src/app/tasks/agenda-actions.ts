'use server'

/**
 * Agenda → Da fare: the list, quick add, and what can be done to one occurrence (done, reopen, postpone, status,
 * outcome, checklist, comment). Reading needs any Agenda page; changing needs "modifica" on Da fare, Calendario or Attività.
 */

import { z } from 'zod';
import { APP_CONFIG } from '@/config/constants';
import { TASK_PAGES } from '@/config/navigation';
import { authorize } from '@/lib/auth/access';
import { isIsoDate } from '@/lib/tasks/dates';
import {
    SETTABLE_STATUSES,
    addComment,
    completeOccurrence,
    postponeOccurrence,
    reopenOccurrence,
    saveOutcome,
    setChecklistStep,
    setOccurrenceStatus,
} from '@/lib/tasks/db/occurrences';
import { loadPeople, today } from '@/lib/tasks/db/shared';
import { insertQuickTask } from '@/lib/tasks/db/tasks';
import { getAgenda, type AgendaData } from '@/lib/tasks/db/views';
import { attempt, refused, type Result, type Saved } from '@/app/tasks/results';
import { APP_COPY } from '@/locales';

const ALL_PAGES = Object.values(TASK_PAGES);
const EDIT_PAGES = [TASK_PAGES.todo, TASK_PAGES.calendar, TASK_PAGES.list];

const IdSchema = z.number().int().positive();
const VersionSchema = z.string().regex(/^0x[0-9A-Fa-f]{16}$/);
const NoteSchema = z.string().max(APP_CONFIG.TASKS.MAX_NOTE_LENGTH).nullable();
const DateSchema = z.string().refine(isIsoDate);

const validTarget = (id: unknown, version: unknown) => IdSchema.safeParse(id).success && VersionSchema.safeParse(version).success;

export async function getAgendaAction(): Promise<Result<{ data: AgendaData }>> {
    const access = await authorize('view', ...ALL_PAGES);
    return attempt('agenda', async () => ({ data: await getAgenda(access, await loadPeople()) }));
}

/** One line typed in Da fare (no date) or on a day of the week view (that date): a one-time task of the person's own */
export async function quickAddAction(title: string, dueDate: string | null = null): Promise<Result<{ id: number }>> {
    const access = await authorize('edit', ...EDIT_PAGES);
    const clean = String(title ?? '').trim();
    if (clean.length === 0 || clean.length > APP_CONFIG.TASKS.MAX_TITLE_LENGTH) return refused(APP_COPY.tasks.messages.titleRequired);
    if (dueDate !== null && !DateSchema.safeParse(dueDate).success) return refused();
    return attempt('quick add', async () => ({ id: await insertQuickTask(access, clean, APP_CONFIG.TASKS.DEFAULT_SHOW_DAYS, dueDate) }));
}

/** Done on `doneOn` (today or earlier), with an optional outcome */
export async function completeOccurrenceAction(id: number, version: string, doneOn: string, outcome: string | null): Promise<Saved> {
    const access = await authorize('edit', ...EDIT_PAGES);
    if (!validTarget(id, version) || !DateSchema.safeParse(doneOn).success || doneOn > today() || !z.string().max(20_000).nullable().safeParse(outcome).success) return refused();
    return attempt('done', async () => {
        await completeOccurrence(access, id, version, doneOn, outcome);
        return {};
    });
}

export async function reopenOccurrenceAction(id: number, version: string): Promise<Saved> {
    const access = await authorize('edit', ...EDIT_PAGES);
    if (!validTarget(id, version)) return refused();
    return attempt('reopen', async () => {
        await reopenOccurrence(access, id, version);
        return {};
    });
}

export async function setOccurrenceStatusAction(id: number, version: string, status: string, note: string | null): Promise<Saved> {
    const access = await authorize('edit', ...EDIT_PAGES);
    const parsedStatus = z.enum(SETTABLE_STATUSES).safeParse(status);
    if (!validTarget(id, version) || !parsedStatus.success || !NoteSchema.safeParse(note).success) return refused();
    return attempt('status', async () => {
        await setOccurrenceStatus(access, id, version, parsedStatus.data, note);
        return {};
    });
}

export async function postponeOccurrenceAction(id: number, version: string, to: string, reason: string | null): Promise<Saved> {
    const access = await authorize('edit', ...EDIT_PAGES);
    if (!validTarget(id, version) || !DateSchema.safeParse(to).success || !NoteSchema.safeParse(reason).success) return refused();
    return attempt('postpone', async () => {
        await postponeOccurrence(access, id, version, to, reason);
        return {};
    });
}

export async function saveOutcomeAction(id: number, version: string, outcome: string): Promise<Saved> {
    const access = await authorize('edit', ...EDIT_PAGES);
    if (!validTarget(id, version) || !z.string().max(20_000).safeParse(outcome).success) return refused();
    return attempt('outcome', async () => {
        await saveOutcome(access, id, version, outcome);
        return {};
    });
}

export async function setChecklistStepAction(id: number, version: string, stepId: string, done: boolean): Promise<Saved> {
    const access = await authorize('edit', ...EDIT_PAGES);
    if (!validTarget(id, version) || !z.string().min(1).max(40).safeParse(stepId).success || typeof done !== 'boolean') return refused();
    return attempt('checklist', async () => {
        await setChecklistStep(access, id, version, stepId, done);
        return {};
    });
}

/** A comment on an occurrence, or on the task when occurrenceId is null */
export async function addCommentAction(taskId: number, occurrenceId: number | null, text: string): Promise<Saved> {
    const access = await authorize('edit', ...EDIT_PAGES);
    const clean = String(text ?? '').trim();
    if (!IdSchema.safeParse(taskId).success || !IdSchema.nullable().safeParse(occurrenceId).success || clean.length === 0 || clean.length > 20_000) return refused();
    return attempt('comment', async () => {
        await addComment(access, taskId, occurrenceId, clean);
        return {};
    });
}
