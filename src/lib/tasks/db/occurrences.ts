/**
 * What happens to one occurrence (scadenza): done, reopened, moved, in progress, waiting, skipped, cancelled, its
 * outcome, checklist ticks and comments. Server only. Every write checks the version (someone else may have changed
 * it), that the person may see the task, and adds its tsk_log line in the same transaction.
 */

import type { UserAccess } from '@/lib/auth/permissions';
import type { SqlParams } from '@/lib/mssql';
import { parseRepeatRule } from '@/lib/tasks/repeat';
import type { OccurrenceStatus } from '@/lib/tasks/types';
import { OPEN_LIST, UNTOUCHED_SQL } from '@/lib/tasks/db/tasks';
import { refreshSeries } from '@/lib/tasks/db/series';
import { NotFound, THROW_IF_STALE, VERSION_MATCH, logSql, parseJson, personKey, rows, transaction, visibleTasksSql } from '@/lib/tasks/db/shared';

/** Statuses a person can set by hand (done and reopen have their own functions) */
export const SETTABLE_STATUSES = ['open', 'progress', 'waiting', 'skipped', 'cancelled'] as const satisfies readonly OccurrenceStatus[];
export type SettableStatus = (typeof SETTABLE_STATUSES)[number];

const STATUS_LOG: Record<SettableStatus, string> = { open: 'opened', progress: 'progress', waiting: 'waiting', skipped: 'skipped', cancelled: 'cancelled' };

/** The occurrence's task, when the person may see it */
async function occurrenceTask(access: UserAccess, id: number): Promise<{ taskId: number; repeat: string | null } | null> {
    const params: SqlParams = { id };
    const found = await rows<{ task_id: number; repeat_rule: string | null }>(
        `SELECT o.task_id, t.repeat_rule FROM tsk_occurrences o WITH (NOLOCK) JOIN tsk_tasks t WITH (NOLOCK) ON t.id = o.task_id
         WHERE o.id = @id AND ${visibleTasksSql(access, params)}`,
        params
    );
    return found[0] ? { taskId: found[0].task_id, repeat: found[0].repeat_rule } : null;
}

/**
 * Runs one change of an occurrence: `set` is the SQL after SET, `where` extra conditions; the log line gets `details`.
 * Throws "stale" when the version no longer matches (or the occurrence is not in a state that allows it).
 */
async function change(access: UserAccess, id: number, version: string, action: string, set: string, extra: SqlParams, where = '', details?: unknown): Promise<number> {
    const task = await occurrenceTask(access, id);
    if (!task) throw new NotFound();
    await rows(
        transaction(`
            UPDATE tsk_occurrences SET ${set}, updated_at = GETDATE(), updated_by = @me
            WHERE id = @id AND ${VERSION_MATCH()} ${where};
            ${THROW_IF_STALE}
            ${logSql('occurrence', '@id', '@taskId', action, details === undefined ? undefined : 'details')}
        `),
        { ...extra, id, version, me: personKey(access), taskId: task.taskId, ...(details === undefined ? {} : { details: JSON.stringify(details) }) }
    );
    return task.taskId;
}

/** Done on a day (today: now; an earlier day: that day), with an optional outcome; a repeating task gets its next one */
export async function completeOccurrence(access: UserAccess, id: number, version: string, doneOn: string, outcome: string | null): Promise<void> {
    const taskId = await change(
        access,
        id,
        version,
        'done',
        `status = 'done', done_by = @me, outcome = COALESCE(@outcome, outcome),
         done_at = CASE WHEN @doneOn = CAST(GETDATE() AS date) THEN GETDATE() ELSE CAST(@doneOn AS datetime2) END`,
        { doneOn, outcome: outcome?.trim() || null },
        `AND status IN (${OPEN_LIST})`,
        outcome?.trim() ? { outcome: outcome.trim() } : undefined
    );
    await refreshSeries([taskId]);
}

/**
 * Back to "da fare". For an "after the last time" task the next occurrence made when this one was closed goes away
 * again (unless someone already worked on it), so there is still one open at a time.
 */
export async function reopenOccurrence(access: UserAccess, id: number, version: string): Promise<void> {
    const task = await occurrenceTask(access, id);
    if (!task) throw new NotFound();
    const afterMode = parseRepeatRule(task.repeat)?.mode === 'after';
    await rows(
        transaction(`
            UPDATE tsk_occurrences SET status = 'open', done_at = NULL, done_by = NULL, updated_at = GETDATE(), updated_by = @me
            WHERE id = @id AND ${VERSION_MATCH()} AND status NOT IN (${OPEN_LIST});
            ${THROW_IF_STALE}
            IF @afterMode = 1
                DELETE o FROM tsk_occurrences o WHERE o.task_id = @taskId AND o.id > @id AND ${UNTOUCHED_SQL};
            ${logSql('occurrence', '@id', '@taskId', 'reopened')}
        `),
        { id, version, me: personKey(access), taskId: task.taskId, afterMode }
    );
}

/** In progress, waiting (for whom), back to open, skipped or cancelled (why) */
export async function setOccurrenceStatus(access: UserAccess, id: number, version: string, status: SettableStatus, note: string | null): Promise<void> {
    const text = note?.trim() || null;
    const taskId = await change(
        access,
        id,
        version,
        STATUS_LOG[status],
        `status = @status, status_note = @note`,
        { status, note: status === 'open' || status === 'progress' ? null : text },
        `AND status IN (${OPEN_LIST})`,
        text ? { note: text } : undefined
    );
    if (status === 'skipped' || status === 'cancelled') await refreshSeries([taskId]);
}

/** Moves the due date (the original date stays, so the history shows it was moved) */
export async function postponeOccurrence(access: UserAccess, id: number, version: string, to: string, reason: string | null): Promise<void> {
    const found = await rows<{ due: string | null }>(`SELECT CONVERT(char(10), due_date, 23) AS due FROM tsk_occurrences WITH (NOLOCK) WHERE id = @id`, { id });
    await change(access, id, version, 'postponed', `due_date = @to`, { to }, `AND status IN (${OPEN_LIST})`, {
        from: found[0]?.due ?? null,
        to,
        ...(reason?.trim() ? { reason: reason.trim() } : {}),
    });
}

/** What was done this time (kept also after it is closed) */
export async function saveOutcome(access: UserAccess, id: number, version: string, outcome: string): Promise<void> {
    await change(access, id, version, 'outcome', `outcome = @outcome`, { outcome: outcome.trim() || null });
}

/** Ticks or unticks one checklist step */
export async function setChecklistStep(access: UserAccess, id: number, version: string, stepId: string, done: boolean): Promise<void> {
    const current = await rows<{ checklist_done: string | null }>(`SELECT checklist_done FROM tsk_occurrences WITH (NOLOCK) WHERE id = @id`, { id });
    const ticked = new Set(parseJson<string[]>(current[0]?.checklist_done, []));
    if (done) ticked.add(stepId);
    else ticked.delete(stepId);
    await change(access, id, version, 'checklist', `checklist_done = @ticked`, { ticked: ticked.size > 0 ? JSON.stringify(Array.from(ticked)) : null }, '', { step: stepId, done });
}

/** A comment on an occurrence (or on the task itself when occurrenceId is null) */
export async function addComment(access: UserAccess, taskId: number, occurrenceId: number | null, text: string): Promise<void> {
    const params: SqlParams = { taskId, occurrenceId, me: personKey(access), details: JSON.stringify({ text: text.trim() }) };
    const visible = await rows<{ id: number }>(
        `SELECT t.id FROM tsk_tasks t WITH (NOLOCK) WHERE t.id = @taskId AND ${visibleTasksSql(access, params)}
           AND (@occurrenceId IS NULL OR EXISTS (SELECT 1 FROM tsk_occurrences o WITH (NOLOCK) WHERE o.id = @occurrenceId AND o.task_id = t.id))`,
        params
    );
    if (!visible[0]) throw new NotFound();
    await rows(
        `INSERT INTO tsk_log (person, entity_kind, entity_id, task_id, action, details)
         VALUES (@me, CASE WHEN @occurrenceId IS NULL THEN 'task' ELSE 'occurrence' END, COALESCE(@occurrenceId, @taskId), @taskId, 'comment', @details)`,
        params
    );
}
