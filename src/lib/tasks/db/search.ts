/**
 * The Agenda's search bar: tasks, procedures and contacts whose words contain the text. Server only; tasks follow who
 * may see which task, and each kind is searched only when the person may open its page.
 */

import { APP_CONFIG } from '@/config/constants';
import type { UserAccess } from '@/lib/auth/permissions';
import type { SqlParams } from '@/lib/mssql';
import { rowSets, visibleTasksSql } from '@/lib/tasks/db/shared';

export type SearchKind = 'task' | 'guide' | 'contact';

export interface SearchHit {
    kind: SearchKind;
    id: number;
    title: string;
    /** Area, or company / phone / e-mail of a contact */
    detail: string | null;
    /** Archived (or paused, for a task): shown last, greyed */
    inactive: boolean;
}

interface HitRow {
    id: number;
    title: string;
    detail: string | null;
    inactive: number;
}

/** "%text%" for LIKE, its own % _ [ taken literally (ESCAPE '\') */
const contains = (text: string) => `%${text.replace(/[\\%_[]/g, '\\$&')}%`;

export async function searchAgenda(access: UserAccess, text: string, kinds: Record<SearchKind, boolean>): Promise<SearchHit[]> {
    const params: SqlParams = { like: contains(text), limit: APP_CONFIG.TASKS.SEARCH_LIMIT };
    const none = 'SELECT TOP 0 0 AS id, \'\' AS title, NULL AS detail, 0 AS inactive';
    const like = (column: string) => `${column} LIKE @like ESCAPE '\\'`;
    const [tasks, guides, contacts] = (await rowSets(
        `${
            kinds.task
                ? `SELECT TOP (@limit) t.id, t.title, a.name AS detail, CASE WHEN t.state = 'active' THEN 0 ELSE 1 END AS inactive
                   FROM tsk_tasks t WITH (NOLOCK) LEFT JOIN tsk_areas a WITH (NOLOCK) ON a.id = t.area_id
                   WHERE (${like('t.title')} OR ${like('t.tags')} OR ${like('t.notes')}) AND ${visibleTasksSql(access, params)}
                   ORDER BY inactive, CASE WHEN ${like('t.title')} THEN 0 ELSE 1 END, t.title`
                : none
        };
         ${
             kinds.guide
                 ? `SELECT TOP (@limit) g.id, g.title, a.name AS detail, CASE WHEN g.state = 'active' THEN 0 ELSE 1 END AS inactive
                    FROM tsk_guides g WITH (NOLOCK) LEFT JOIN tsk_areas a WITH (NOLOCK) ON a.id = g.area_id
                    WHERE ${like('g.title')} OR ${like('g.body')}
                    ORDER BY inactive, CASE WHEN ${like('g.title')} THEN 0 ELSE 1 END, g.title`
                 : none
         };
         ${
             kinds.contact
                 ? `SELECT TOP (@limit) c.id, c.name AS title, CONCAT_WS(' · ', c.company, c.phone, c.email) AS detail,
                           CASE WHEN c.state = 'active' THEN 0 ELSE 1 END AS inactive
                    FROM tsk_contacts c WITH (NOLOCK)
                    WHERE ${like('c.name')} OR ${like('c.company')} OR ${like('c.role')} OR ${like('c.email')} OR ${like('c.phone')}
                    ORDER BY inactive, c.name`
                 : none
         };`,
        params
    )) as [HitRow[], HitRow[], HitRow[]];
    const hits = (kind: SearchKind, list: HitRow[]): SearchHit[] =>
        list.map((row) => ({ kind, id: row.id, title: row.title, detail: row.detail || null, inactive: row.inactive === 1 }));
    return [...hits('task', tasks), ...hits('guide', guides), ...hits('contact', contacts)];
}
