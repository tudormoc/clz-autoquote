/**
 * Tasks (tsk_tasks) with their links, procedures and contacts. Server only; the actions in src/app/tasks check who
 * may call these, and every read and write here also checks that the person may see the task.
 */

import type { UserAccess } from '@/lib/auth/permissions';
import type { SqlParams } from '@/lib/mssql';
import { parseRepeatRule } from '@/lib/tasks/repeat';
import {
    OPEN_STATUSES,
    type ChecklistItem,
    type Person,
    type Priority,
    type TaskDetail,
    type TaskInput,
    type TaskLink,
    type TaskState,
    type TaskSummary,
    type Visibility,
} from '@/lib/tasks/types';
import {
    DATE_SQL,
    MOMENT_SQL,
    THROW_IF_STALE,
    TIME_SQL,
    VERSION_MATCH,
    VERSION_SQL,
    logSql,
    nameResolver,
    parseJson,
    personKey,
    rowSets,
    rows,
    today,
    transaction,
    visibleTasksSql,
} from '@/lib/tasks/db/shared';

export const OPEN_LIST = OPEN_STATUSES.map((status) => `'${status}'`).join(', ');

/** An open occurrence nobody has touched yet (no note, tick, move, comment or link): the rule may remake it */
export const UNTOUCHED_SQL = `o.status = 'open' AND o.outcome IS NULL AND o.checklist_done IS NULL
    AND (o.due_date = o.original_date OR (o.due_date IS NULL AND o.original_date IS NULL))
    AND NOT EXISTS (SELECT 1 FROM tsk_log l WHERE l.entity_kind = 'occurrence' AND l.entity_id = o.id)
    AND NOT EXISTS (SELECT 1 FROM tsk_links k WHERE k.owner_kind = 'occurrence' AND k.owner_id = o.id)`;

interface TaskRow {
    id: number;
    title: string;
    notes: string | null;
    area_id: number | null;
    area_name: string | null;
    tags: string | null;
    priority: Priority;
    assignee: string | null;
    group_id: number | null;
    visibility: Visibility;
    due_date: string | null;
    due_time: string | null;
    repeat_rule: string | null;
    show_days: number;
    checklist: string | null;
    estimate_minutes: number | null;
    state: TaskState;
    created_at: string;
    created_by: string;
    updated_at: string;
    updated_by: string;
    version: string;
    next_due: string | null;
    open_count: number;
    last_done: string | null;
}

const TASK_SELECT = `
    SELECT t.id, t.title, t.notes, t.area_id, a.name AS area_name, t.tags, t.priority, t.assignee, t.group_id, t.visibility,
           ${DATE_SQL('t.due_date')} AS due_date, ${TIME_SQL('t.due_time')} AS due_time, t.repeat_rule, t.show_days,
           t.checklist, t.estimate_minutes, t.state,
           ${MOMENT_SQL('t.created_at')} AS created_at, t.created_by, ${MOMENT_SQL('t.updated_at')} AS updated_at, t.updated_by,
           ${VERSION_SQL('t.row_version')} AS version,
           (SELECT ${DATE_SQL('MIN(o.due_date)')} FROM tsk_occurrences o WITH (NOLOCK) WHERE o.task_id = t.id AND o.status IN (${OPEN_LIST})) AS next_due,
           (SELECT COUNT(*) FROM tsk_occurrences o WITH (NOLOCK) WHERE o.task_id = t.id AND o.status IN (${OPEN_LIST})) AS open_count,
           (SELECT ${DATE_SQL('MAX(o.done_at)')} FROM tsk_occurrences o WITH (NOLOCK) WHERE o.task_id = t.id AND o.status = 'done') AS last_done
    FROM tsk_tasks t WITH (NOLOCK)
    LEFT JOIN tsk_areas a WITH (NOLOCK) ON a.id = t.area_id`;

const splitTags = (tags: string | null) => (tags ? tags.split(',').map((tag) => tag.trim()).filter(Boolean) : []);

function toSummary(row: TaskRow, nameOf: (key: string | null) => string | null): TaskSummary {
    return {
        id: row.id,
        title: row.title,
        areaId: row.area_id,
        areaName: row.area_name,
        tags: splitTags(row.tags),
        priority: row.priority,
        assignee: row.assignee,
        assigneeName: nameOf(row.assignee),
        state: row.state,
        dueDate: row.due_date,
        dueTime: row.due_time,
        repeat: parseRepeatRule(row.repeat_rule),
        nextDue: row.next_due,
        openCount: row.open_count,
        lastDone: row.last_done,
    };
}

/** Every task the person may see, all states (the list filters them) */
export async function listTasks(access: UserAccess, people: Person[]): Promise<TaskSummary[]> {
    const params: SqlParams = {};
    const list = await rows<TaskRow>(`${TASK_SELECT} WHERE ${visibleTasksSql(access, params)} ORDER BY t.title`, params);
    const nameOf = nameResolver(people);
    return list.map((row) => toSummary(row, nameOf));
}

/** A task with everything it holds, or null when it does not exist or the person may not see it */
export async function getTask(access: UserAccess, id: number, people: Person[]): Promise<TaskDetail | null> {
    const params: SqlParams = { id };
    const [found, links, guides, contacts] = (await rowSets(
        `${TASK_SELECT} WHERE t.id = @id AND ${visibleTasksSql(access, params)};
         SELECT label, kind, value FROM tsk_links WITH (NOLOCK) WHERE owner_kind = 'task' AND owner_id = @id ORDER BY sort_order, id;
         SELECT guide_id FROM tsk_task_guides WITH (NOLOCK) WHERE task_id = @id ORDER BY sort_order;
         SELECT contact_id FROM tsk_contact_refs WITH (NOLOCK) WHERE owner_kind = 'task' AND owner_id = @id;`,
        params
    )) as [TaskRow[], TaskLink[], { guide_id: number }[], { contact_id: number }[]];
    const row = found[0];
    if (!row) return null;
    const nameOf = nameResolver(people);
    return {
        ...toSummary(row, nameOf),
        notes: row.notes ?? '',
        groupId: row.group_id,
        visibility: row.visibility,
        showDays: row.show_days,
        checklist: parseJson<ChecklistItem[]>(row.checklist, []),
        estimateMinutes: row.estimate_minutes,
        links: links.map((link) => ({ label: link.label ?? '', kind: link.kind, value: link.value })),
        guideIds: guides.map((guide) => guide.guide_id),
        contactIds: contacts.map((contact) => contact.contact_id),
        createdAt: row.created_at,
        createdBy: nameOf(row.created_by) ?? '',
        updatedAt: row.updated_at,
        updatedBy: nameOf(row.updated_by) ?? '',
        version: row.version,
    };
}

/** The task's links, procedures and contacts, written again (inside a batch; @id, @links, @guideIds, @contactIds) */
const REPLACE_REFS_SQL = `
    DELETE FROM tsk_links WHERE owner_kind = 'task' AND owner_id = @id;
    INSERT INTO tsk_links (owner_kind, owner_id, label, kind, value, sort_order)
    SELECT 'task', @id, NULLIF(JSON_VALUE(j.value, '$.label'), ''), JSON_VALUE(j.value, '$.kind'), JSON_VALUE(j.value, '$.value'), CAST(j.[key] AS INT)
    FROM OPENJSON(@links) j;

    DELETE FROM tsk_task_guides WHERE task_id = @id;
    INSERT INTO tsk_task_guides (task_id, guide_id, sort_order)
    SELECT @id, g.id, MIN(CAST(j.[key] AS INT)) FROM OPENJSON(@guideIds) j JOIN tsk_guides g ON g.id = TRY_CAST(j.value AS INT) GROUP BY g.id;

    DELETE FROM tsk_contact_refs WHERE owner_kind = 'task' AND owner_id = @id;
    INSERT INTO tsk_contact_refs (contact_id, owner_kind, owner_id)
    SELECT DISTINCT c.id, 'task', @id FROM OPENJSON(@contactIds) j JOIN tsk_contacts c ON c.id = TRY_CAST(j.value AS INT);`;

/** The task's own columns as parameters */
function taskParams(input: TaskInput, access: UserAccess): SqlParams {
    return {
        me: personKey(access),
        today: today(),
        title: input.title,
        notes: input.notes.trim() || null,
        areaId: input.areaId,
        tags: input.tags.length > 0 ? input.tags.join(', ') : null,
        priority: input.priority,
        assignee: input.assignee,
        groupId: input.visibility === 'group' ? input.groupId : null,
        visibility: input.visibility,
        dueDate: input.dueDate,
        dueTime: input.dueTime,
        repeat: input.repeat ? JSON.stringify(input.repeat) : null,
        showDays: input.showDays,
        checklist: input.checklist.length > 0 ? JSON.stringify(input.checklist) : null,
        estimate: input.estimateMinutes,
        links: JSON.stringify(input.links),
        guideIds: JSON.stringify(input.guideIds),
        contactIds: JSON.stringify(input.contactIds),
    };
}

/** Creates a task (a one-time task gets its occurrence at once); returns its id */
export async function insertTask(access: UserAccess, input: TaskInput): Promise<number> {
    const result = await rows<{ id: number }>(
        transaction(`
            DECLARE @id INT;
            INSERT INTO tsk_tasks (title, notes, area_id, tags, priority, assignee, group_id, visibility, due_date, due_time,
                                   repeat_rule, repeat_from, show_days, checklist, estimate_minutes, created_by, updated_by)
            VALUES (@title, @notes, @areaId, @tags, @priority, @assignee, @groupId, @visibility, @dueDate, @dueTime,
                    @repeat, @today, @showDays, @checklist, @estimate, @me, @me);
            SET @id = SCOPE_IDENTITY();
            ${REPLACE_REFS_SQL}
            IF @repeat IS NULL
                INSERT INTO tsk_occurrences (task_id, original_date, due_date, due_time, updated_by) VALUES (@id, @dueDate, @dueDate, @dueTime, @me);
            ${logSql('task', '@id', '@id', 'created')}
            SELECT @id AS id;
        `),
        taskParams(input, access)
    );
    return result[0].id;
}

/** The fields that differ between the stored task and the form (for the log) */
function changedFields(before: TaskDetail, input: TaskInput): string[] {
    const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
    const pairs: [string, unknown, unknown][] = [
        ['title', before.title, input.title],
        ['notes', before.notes, input.notes.trim()],
        ['area', before.areaId, input.areaId],
        ['tags', before.tags, input.tags],
        ['priority', before.priority, input.priority],
        ['assignee', before.assignee, input.assignee],
        ['visibility', [before.visibility, before.groupId], [input.visibility, input.visibility === 'group' ? input.groupId : null]],
        ['date', [before.dueDate, before.dueTime], [input.dueDate, input.dueTime]],
        ['repeat', before.repeat, input.repeat],
        ['showDays', before.showDays, input.showDays],
        ['checklist', before.checklist, input.checklist],
        ['estimate', before.estimateMinutes, input.estimateMinutes],
        ['links', before.links, input.links],
        ['guides', before.guideIds, input.guideIds],
        ['contacts', before.contactIds, input.contactIds],
    ];
    return pairs.filter(([, a, b]) => !same(a, b)).map(([field]) => field);
}

/**
 * Saves the form over a task. When its dates or rule change, the past stays as it was: the future open occurrences
 * nobody touched are removed and made again from the new rule (from today on).
 * Throws the "stale" error when someone saved the task in the meantime.
 */
export async function updateTask(access: UserAccess, before: TaskDetail, input: TaskInput, version: string): Promise<void> {
    const fields = changedFields(before, input);
    if (fields.length === 0) return;
    const scheduleChanged = fields.includes('date') || fields.includes('repeat');
    await rows(
        transaction(`
            UPDATE tsk_tasks SET title = @title, notes = @notes, area_id = @areaId, tags = @tags, priority = @priority,
                   assignee = @assignee, group_id = @groupId, visibility = @visibility, due_date = @dueDate, due_time = @dueTime,
                   repeat_rule = @repeat, show_days = @showDays, checklist = @checklist, estimate_minutes = @estimate,
                   repeat_from = CASE WHEN @scheduleChanged = 1 THEN @today ELSE repeat_from END,
                   updated_at = GETDATE(), updated_by = @me
            WHERE id = @id AND ${VERSION_MATCH()};
            ${THROW_IF_STALE}
            ${REPLACE_REFS_SQL}
            IF @scheduleChanged = 1
            BEGIN
                DELETE o FROM tsk_occurrences o
                WHERE o.task_id = @id AND ${UNTOUCHED_SQL}
                  AND (@repeat IS NULL OR o.original_date IS NULL OR o.original_date >= @today);
                IF @repeat IS NULL
                BEGIN
                    UPDATE tsk_occurrences SET original_date = @dueDate, due_date = @dueDate, due_time = @dueTime, updated_at = GETDATE(), updated_by = @me
                    WHERE id = (SELECT TOP 1 id FROM tsk_occurrences WHERE task_id = @id AND status IN (${OPEN_LIST}) ORDER BY id DESC);
                    IF NOT EXISTS (SELECT 1 FROM tsk_occurrences WHERE task_id = @id AND status IN (${OPEN_LIST}))
                        INSERT INTO tsk_occurrences (task_id, original_date, due_date, due_time, updated_by)
                        SELECT @id, @dueDate, @dueDate, @dueTime, @me
                        WHERE NOT EXISTS (SELECT 1 FROM tsk_occurrences WHERE task_id = @id
                                          AND (original_date = @dueDate OR (original_date IS NULL AND @dueDate IS NULL)));
                END
            END
            ELSE
                UPDATE tsk_occurrences SET due_time = @dueTime WHERE task_id = @id AND status IN (${OPEN_LIST});
            ${logSql('task', '@id', '@id', 'changed', 'details')}
        `),
        { ...taskParams(input, access), id: before.id, version, scheduleChanged, details: JSON.stringify({ fields }) }
    );
}

/** Saves only the instructions of a task ("Come si fa" changed in place); throws "stale" when changed meanwhile */
export async function updateTaskNotes(access: UserAccess, id: number, version: string, notes: string): Promise<void> {
    await rows(
        transaction(`
            UPDATE tsk_tasks SET notes = @notes, updated_at = GETDATE(), updated_by = @me WHERE id = @id AND ${VERSION_MATCH()};
            ${THROW_IF_STALE}
            ${logSql('task', '@id', '@id', 'changed', 'details')}
        `),
        { id, version, notes: notes.trim() || null, me: personKey(access), details: JSON.stringify({ fields: ['notes'] }) }
    );
}

const STATE_ACTIONS: Record<TaskState, 'resumed' | 'paused' | 'archived'> = { active: 'resumed', paused: 'paused', archived: 'archived' };

/**
 * Pause, archive or make active again. Paused and archived tasks get no new occurrences (their future untouched ones
 * are removed); made active again, the rule starts from today.
 */
export async function updateTaskState(access: UserAccess, id: number, version: string, state: TaskState, from: TaskState): Promise<void> {
    const action = state === 'active' && from === 'archived' ? 'restored' : STATE_ACTIONS[state];
    await rows(
        transaction(`
            UPDATE tsk_tasks SET state = @state, updated_at = GETDATE(), updated_by = @me,
                   repeat_from = CASE WHEN @state = 'active' THEN @today ELSE repeat_from END
            WHERE id = @id AND ${VERSION_MATCH()};
            ${THROW_IF_STALE}
            IF @state <> 'active'
                DELETE o FROM tsk_occurrences o JOIN tsk_tasks t ON t.id = o.task_id
                WHERE o.task_id = @id AND t.repeat_rule IS NOT NULL AND o.original_date >= @today AND ${UNTOUCHED_SQL};
            ${logSql('task', '@id', '@id', action)}
        `),
        { me: personKey(access), today: today(), id, version, state }
    );
}

/** One quick line ("Da fare", or a day of the week view): a one-time task of the person's own, with or without a date */
export async function insertQuickTask(access: UserAccess, title: string, showDays: number, dueDate: string | null): Promise<number> {
    const me = personKey(access);
    return insertTask(access, {
        title,
        notes: '',
        areaId: null,
        tags: [],
        priority: 0,
        assignee: me,
        groupId: null,
        visibility: 'private',
        dueDate,
        dueTime: null,
        repeat: null,
        showDays,
        checklist: [],
        estimateMinutes: null,
        links: [],
        guideIds: [],
        contactIds: [],
    });
}
