/**
 * The app-wide log (Registro), reading side (server only, read queries): app_log together with the Agenda's log
 * (tsk_log) and the timesheet's (timesheet_log), newest first, as one list. Written by src/lib/log/log.ts and by
 * those two modules.
 */
import sql from 'mssql';
import { getMSSQLPool } from '@/lib/mssql';

export type LogSource = 'app' | 'tasks' | 'timesheet';

export interface LogEntryRow {
    source: LogSource;
    id: number;
    logged_at: Date;
    person: string;
    person_name: string;
    /** Page id of the menu, or login / tasks / timesheet */
    area: string;
    action: string;
    entity_kind: string | null;
    entity_id: string | null;
    summary: string;
    outcome: string;
    error: string | null;
    has_details: number;
}

export interface LogFilters {
    dateFrom?: string;
    dateTo?: string;
    /** Part of the person's name */
    person?: string;
    /** Part of the description, the action or what it was done to (a commessa, a code) */
    text?: string;
    /** The areas the person may see (page ids, login, tasks, timesheet); none given = every area */
    areas?: string[];
}

/** The three logs as one list. The Agenda and the timesheet store the person's id only: the name is today's. */
const ENTRIES = `
    WITH entries AS (
        SELECT CAST('app' AS VARCHAR(10)) AS source, l.id, l.logged_at, l.person, l.person_name, l.area, l.action,
               l.entity_kind, l.entity_id, l.summary, l.outcome, l.error, CASE WHEN l.details IS NULL THEN 0 ELSE 1 END AS has_details
        FROM app_log l WITH (NOLOCK)
        UNION ALL
        SELECT 'tasks', l.id, l.logged_at, l.person, CAST(ISNULL(u.name, l.person) AS NVARCHAR(100)), 'tasks', l.action,
               l.entity_kind, CAST(l.entity_id AS NVARCHAR(100)), CAST(ISNULL(t.title, '') AS NVARCHAR(400)), 'ok', NULL,
               CASE WHEN l.details IS NULL THEN 0 ELSE 1 END
        FROM tsk_log l WITH (NOLOCK)
        LEFT JOIN app_users u WITH (NOLOCK) ON u.id = TRY_CAST(l.person AS INT)
        LEFT JOIN tsk_tasks t WITH (NOLOCK) ON t.id = l.task_id
        UNION ALL
        SELECT 'timesheet', l.id, l.logged_at, l.person, CAST(ISNULL(u.name, l.person) AS NVARCHAR(100)), 'timesheet', l.action,
               'day', CAST(l.operator_code AS NVARCHAR(100)), CAST(l.operator_code + ' · ' + CONVERT(VARCHAR(10), l.day, 103) AS NVARCHAR(400)), 'ok', NULL,
               CASE WHEN l.details IS NULL THEN 0 ELSE 1 END
        FROM timesheet_log l WITH (NOLOCK)
        LEFT JOIN app_users u WITH (NOLOCK) ON u.id = TRY_CAST(l.person AS INT)
    )`;

/** A request with the filters' parameters and the matching WHERE clause */
async function entriesRequest(filters: LogFilters) {
    const request = (await getMSSQLPool('QUOTES')).request();
    const conditions: string[] = ['1 = 1'];
    if (filters.dateFrom) {
        conditions.push('logged_at >= @dateFrom');
        request.input('dateFrom', sql.Date, filters.dateFrom);
    }
    if (filters.dateTo) {
        conditions.push('logged_at < DATEADD(DAY, 1, @dateTo)');
        request.input('dateTo', sql.Date, filters.dateTo);
    }
    if (filters.person) {
        conditions.push('person_name LIKE @person');
        request.input('person', sql.NVarChar, `%${filters.person}%`);
    }
    if (filters.text) {
        conditions.push('(summary LIKE @text OR entity_id LIKE @text OR action LIKE @text OR area LIKE @text)');
        request.input('text', sql.NVarChar, `%${filters.text}%`);
    }
    if (filters.areas) {
        // No area at all: nothing to show
        conditions.push(filters.areas.length > 0 ? `area IN (${filters.areas.map((_, i) => `@area${i}`).join(', ')})` : '1 = 0');
        filters.areas.forEach((area, i) => request.input(`area${i}`, sql.VarChar, area));
    }
    return { request, where: conditions.join(' AND ') };
}

/** One page of the log, newest first, and how many entries match */
export async function loadLogEntries(filters: LogFilters, offset: number, limit: number): Promise<{ rows: LogEntryRow[]; total: number }> {
    const { request, where } = await entriesRequest(filters);
    const count = await request.query<{ total: number }>(`${ENTRIES} SELECT COUNT(*) AS total FROM entries WHERE ${where}`);
    request.input('offset', sql.Int, offset);
    request.input('limit', sql.Int, limit);
    const rows = await request.query<LogEntryRow>(`
        ${ENTRIES}
        SELECT source, id, logged_at, person, person_name, area, action, entity_kind, entity_id, summary, outcome, error, has_details
        FROM entries
        WHERE ${where}
        ORDER BY logged_at DESC, source, id DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);
    return { rows: rows.recordset, total: count.recordset[0].total };
}

const DETAILS_TABLE: Record<LogSource, string> = { app: 'app_log', tasks: 'tsk_log', timesheet: 'timesheet_log' };

/** The full record of one entry (its JSON text), or null; `areas` as in the list (an entry outside them gives null) */
export async function loadLogDetails(source: LogSource, id: number, areas?: string[]): Promise<string | null> {
    const table = Object.hasOwn(DETAILS_TABLE, source) ? DETAILS_TABLE[source] : null;
    if (!table) return null;
    // The Agenda's and the timesheet's entries are one area each; the app's own carry theirs
    if (areas && source !== 'app' && !areas.includes(source)) return null;
    const request = (await getMSSQLPool('QUOTES')).request();
    request.input('id', sql.BigInt, id);
    let inAreas = '';
    if (areas && source === 'app') {
        if (areas.length === 0) return null;
        inAreas = ` AND area IN (${areas.map((_, i) => `@area${i}`).join(', ')})`;
        areas.forEach((area, i) => request.input(`area${i}`, sql.VarChar, area));
    }
    const result = await request.query<{ details: string | null }>(`SELECT details FROM ${table} WITH (NOLOCK) WHERE id = @id${inAreas}`);
    return result.recordset[0]?.details ?? null;
}
