/**
 * Keeps the occurrences of repeating tasks up to date (src/lib/tasks/series.ts decides, this reads and writes).
 * Runs when the Agenda is opened, after a task is saved and after an occurrence is closed. Running it twice changes
 * nothing: one occurrence per task and date (UQ_tsk_occurrences_task_date), and nothing is written when nothing is due.
 */

import { parseRepeatRule } from '@/lib/tasks/repeat';
import { planSeries, type StoredOccurrence } from '@/lib/tasks/series';
import { OPEN_STATUSES, type OccurrenceStatus } from '@/lib/tasks/types';
import { DATE_SQL, SYSTEM_PERSON, rowSets, rows, today as todayDate, transaction } from '@/lib/tasks/db/shared';
import type { SqlParams } from '@/lib/mssql';

interface SeriesRow {
    id: number;
    repeat_rule: string;
    anchor: string;
    repeat_from: string;
    show_days: number;
    made: number;
    latest: string | null;
    latest_shown: string | null;
}

interface OccurrenceRow {
    id: number;
    task_id: number;
    original_date: string | null;
    due_date: string | null;
    status: OccurrenceStatus;
    done_date: string | null;
}

const OPEN_LIST = OPEN_STATUSES.map((status) => `'${status}'`).join(', ');

/** Brings the series of these tasks (default: every active repeating task) up to today */
export async function refreshSeries(taskIds?: number[]): Promise<void> {
    if (taskIds && taskIds.length === 0) return;
    const today = todayDate();
    const params: SqlParams = { today };
    const only = taskIds ? 'AND t.id IN (SELECT TRY_CAST(value AS INT) FROM STRING_SPLIT(@ids, \',\'))' : '';
    if (taskIds) params.ids = taskIds.join(',');

    const [series, occurrences] = (await rowSets(
        `SELECT t.id, t.repeat_rule, ${DATE_SQL('t.due_date')} AS anchor,
                ${DATE_SQL('COALESCE(t.repeat_from, CAST(t.created_at AS date))')} AS repeat_from, t.show_days,
                COUNT(o.id) AS made, ${DATE_SQL('MAX(o.original_date)')} AS latest,
                ${DATE_SQL('MAX(CASE WHEN o.original_date <= DATEADD(day, t.show_days, @today) THEN o.original_date END)')} AS latest_shown
         FROM tsk_tasks t WITH (NOLOCK)
         LEFT JOIN tsk_occurrences o WITH (NOLOCK) ON o.task_id = t.id
         WHERE t.state = 'active' AND t.repeat_rule IS NOT NULL AND t.due_date IS NOT NULL ${only}
         GROUP BY t.id, t.repeat_rule, t.due_date, t.repeat_from, t.created_at, t.show_days;

         SELECT o.id, o.task_id, ${DATE_SQL('o.original_date')} AS original_date, ${DATE_SQL('o.due_date')} AS due_date,
                o.status, ${DATE_SQL('o.done_at')} AS done_date
         FROM tsk_occurrences o WITH (NOLOCK)
         JOIN tsk_tasks t WITH (NOLOCK) ON t.id = o.task_id
         WHERE t.state = 'active' AND t.repeat_rule IS NOT NULL ${only}
           AND (o.status IN (${OPEN_LIST}) OR JSON_VALUE(t.repeat_rule, '$.mode') = 'after');`,
        params
    )) as [SeriesRow[], OccurrenceRow[]];

    const byTask = new Map<number, StoredOccurrence[]>();
    for (const row of occurrences) {
        const list = byTask.get(row.task_id) ?? [];
        list.push({ id: row.id, originalDate: row.original_date, dueDate: row.due_date, status: row.status, doneDate: row.done_date });
        byTask.set(row.task_id, list);
    }

    const create: { t: number; d: string; s: string }[] = [];
    const replace: number[] = [];
    for (const task of series) {
        const rule = parseRepeatRule(task.repeat_rule);
        if (!rule) continue;
        const plan = planSeries(
            {
                rule,
                anchor: task.anchor,
                repeatFrom: task.repeat_from,
                showDays: task.show_days,
                made: task.made,
                latestDate: task.latest,
                latestShownDate: task.latest_shown,
                occurrences: byTask.get(task.id) ?? [],
            },
            today
        );
        create.push(...plan.create.map((item) => ({ t: task.id, d: item.date, s: item.status })));
        replace.push(...plan.replace);
    }
    if (create.length === 0 && replace.length === 0) return;

    await rows(
        transaction(`
            INSERT INTO tsk_occurrences (task_id, original_date, due_date, due_time, status, updated_by)
            SELECT j.t, j.d, j.d, t.due_time, j.s, '${SYSTEM_PERSON}'
            FROM OPENJSON(@create) WITH (t INT '$.t', d DATE '$.d', s VARCHAR(10) '$.s') j
            JOIN tsk_tasks t ON t.id = j.t
            WHERE NOT EXISTS (SELECT 1 FROM tsk_occurrences o WITH (UPDLOCK, HOLDLOCK) WHERE o.task_id = j.t AND o.original_date = j.d);

            DECLARE @replaced TABLE (id INT, task_id INT);
            UPDATE tsk_occurrences SET status = 'replaced', updated_at = GETDATE(), updated_by = '${SYSTEM_PERSON}'
            OUTPUT INSERTED.id, INSERTED.task_id INTO @replaced
            WHERE id IN (SELECT TRY_CAST(value AS INT) FROM STRING_SPLIT(@replace, ',')) AND status = 'open';
            INSERT INTO tsk_log (person, entity_kind, entity_id, task_id, action)
            SELECT '${SYSTEM_PERSON}', 'occurrence', id, task_id, 'replaced' FROM @replaced;
        `),
        { create: JSON.stringify(create), replace: replace.join(',') }
    );
}
