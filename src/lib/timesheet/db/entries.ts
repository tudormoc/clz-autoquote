/**
 * The lines of the timesheet (timesheet_entries in QUOTES, created by sql/timesheet/001_create_tables.sql). Server only.
 * Every insert, change and delete runs in one transaction with its timesheet_log line, which keeps the row as it was
 * before and as it is after (JSON); reads use NOLOCK. Who may write which person's lines is decided by the actions.
 */

import type { UserAccess } from '@/lib/auth/permissions';
import { DATE_SQL, THROW_IF_STALE, TIME_SQL, VERSION_MATCH, VERSION_SQL, personKey, rows, transaction } from '@/lib/appTables';
import type { SqlParams, SqlRunner } from '@/lib/mssql';
import type { Entry, EntryInput, EntryKind } from '@/lib/timesheet/types';

interface EntryRow {
    id: number;
    operator_code: string;
    day: string;
    kind: EntryKind;
    time_from: string | null;
    time_to: string | null;
    hours: number | null;
    causale: string | null;
    note: string | null;
    version: string;
}

const ENTRY_SELECT = `SELECT e.id, e.operator_code, ${DATE_SQL('e.day')} AS day, e.kind, ${TIME_SQL('e.time_from')} AS time_from,
        ${TIME_SQL('e.time_to')} AS time_to, e.hours, e.causale, e.note, ${VERSION_SQL('e.row_version')} AS version
    FROM timesheet_entries e WITH (NOLOCK)`;

const toEntry = (row: EntryRow): Entry => ({
    id: row.id,
    operatorCode: row.operator_code.trim(),
    day: row.day,
    kind: row.kind,
    timeFrom: row.time_from,
    timeTo: row.time_to,
    hours: row.hours == null ? null : Number(row.hours),
    causale: row.causale ?? '',
    note: row.note ?? '',
    version: row.version,
});

/** The lines of these people between two days (included), in day and time order */
export async function listEntries(operatorCodes: readonly string[], from: string, to: string): Promise<Entry[]> {
    if (operatorCodes.length === 0) return [];
    const list = await rows<EntryRow>(
        `${ENTRY_SELECT}
         WHERE e.day >= @from AND e.day <= @to AND e.operator_code IN (SELECT value FROM STRING_SPLIT(@codes, ','))
         ORDER BY e.day, e.time_from, e.id`,
        { from, to, codes: operatorCodes.join(',') }
    );
    return list.map(toEntry);
}

export async function getEntry(id: number): Promise<Entry | null> {
    const list = await rows<EntryRow>(`${ENTRY_SELECT} WHERE e.id = @id`, { id });
    return list[0] ? toEntry(list[0]) : null;
}

/** The parameters of a write: the line's values and, for the log, who writes and the line as JSON; `i` tells lines of one batch apart */
const entryParams = (access: UserAccess, input: EntryInput, i: number | '' = '') => ({
    me: personKey(access),
    [`kind${i}`]: input.kind,
    [`timeFrom${i}`]: input.timeFrom,
    [`timeTo${i}`]: input.timeTo,
    [`hours${i}`]: input.hours,
    [`causale${i}`]: input.causale || null,
    [`note${i}`]: input.note || null,
    [`after${i}`]: JSON.stringify(input),
});

const ENTRY_INSERT = `INSERT INTO timesheet_entries (operator_code, day, kind, time_from, time_to, hours, causale, note, created_by, updated_by)`;

/** The row as it is now, as JSON for the log (NULL when there is no such row) */
const BEFORE_SQL = `(SELECT kind, ${TIME_SQL('time_from')} AS timeFrom, ${TIME_SQL('time_to')} AS timeTo, hours, causale, note
    FROM timesheet_entries WHERE id = @id FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES)`;

const LOG_INSERT = `INSERT INTO timesheet_log (person, entry_id, operator_code, day, action, details)`;

export async function insertEntry(access: UserAccess, operatorCode: string, day: string, input: EntryInput): Promise<number> {
    const result = await rows<{ id: number }>(
        transaction(`
            DECLARE @id INT;
            ${ENTRY_INSERT}
            VALUES (@operatorCode, @day, @kind, @timeFrom, @timeTo, @hours, @causale, @note, @me, @me);
            SET @id = SCOPE_IDENTITY();
            ${LOG_INSERT} VALUES (@me, @id, @operatorCode, @day, 'created', '{"after":' + @after + '}');
            SELECT @id AS id;
        `),
        { ...entryParams(access, input), operatorCode, day }
    );
    return result[0].id;
}

/** Several lines of one day land together with their log lines: all of them, or none (the one-click chips; "Completa i giorni mancanti" calls it once per day) */
export async function insertDayEntries(access: UserAccess, operatorCode: string, day: string, inputs: readonly EntryInput[]): Promise<void> {
    if (inputs.length === 0) return;
    const statements = inputs.map(
        (_, i) => `${ENTRY_INSERT}
            VALUES (@operatorCode, @day, @kind${i}, @timeFrom${i}, @timeTo${i}, @hours${i}, @causale${i}, @note${i}, @me, @me);
            ${LOG_INSERT} VALUES (@me, SCOPE_IDENTITY(), @operatorCode, @day, 'created', '{"after":' + @after${i} + '}');`
    );
    const params = Object.assign({ operatorCode, day }, ...inputs.map((input, i) => entryParams(access, input, i)));
    await rows(transaction(statements.join('\n')), params);
}

/** Logs every line of a person's day as deleted (its values as JSON) and deletes them; part of a transaction */
const DAY_DELETE_SQL = `${LOG_INSERT}
            SELECT @me, e.id, e.operator_code, e.day, 'deleted',
                '{"before":' + ISNULL((SELECT e2.kind, ${TIME_SQL('e2.time_from')} AS timeFrom, ${TIME_SQL('e2.time_to')} AS timeTo, e2.hours, e2.causale, e2.note
                    FROM timesheet_entries e2 WHERE e2.id = e.id FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES), 'null') + '}'
            FROM timesheet_entries e WHERE e.operator_code = @operatorCode AND e.day = @day;
            DELETE FROM timesheet_entries WHERE operator_code = @operatorCode AND day = @day;`;

/** A whole-day line (ferie, malattia) takes the day over: every line it held is logged and deleted, the new one lands, all in one transaction */
export async function replaceDayEntries(access: UserAccess, operatorCode: string, day: string, input: EntryInput): Promise<number> {
    const result = await rows<{ id: number }>(
        transaction(`
            DECLARE @id INT;
            ${DAY_DELETE_SQL}
            ${ENTRY_INSERT}
            VALUES (@operatorCode, @day, @kind, @timeFrom, @timeTo, @hours, @causale, @note, @me, @me);
            SET @id = SCOPE_IDENTITY();
            ${LOG_INSERT} VALUES (@me, @id, @operatorCode, @day, 'created', '{"after":' + @after + '}');
            SELECT @id AS id;
        `),
        { ...entryParams(access, input), operatorCode, day }
    );
    return result[0].id;
}

/** "Svuota giorno": every line of the day deleted together, each kept in the log, one transaction */
export async function deleteDayEntries(access: UserAccess, operatorCode: string, day: string): Promise<void> {
    await rows(transaction(DAY_DELETE_SQL), { operatorCode, day, me: personKey(access) });
}

export async function updateEntry(access: UserAccess, id: number, version: string, input: EntryInput): Promise<void> {
    await rows(
        transaction(`
            DECLARE @before NVARCHAR(MAX) = ${BEFORE_SQL};
            DECLARE @operatorCode VARCHAR(20), @day DATE;
            SELECT @operatorCode = operator_code, @day = day FROM timesheet_entries WHERE id = @id;
            UPDATE timesheet_entries
            SET kind = @kind, time_from = @timeFrom, time_to = @timeTo, hours = @hours, causale = @causale, note = @note,
                updated_at = GETDATE(), updated_by = @me
            WHERE id = @id AND ${VERSION_MATCH()};
            ${THROW_IF_STALE}
            ${LOG_INSERT} VALUES (@me, @id, @operatorCode, @day, 'changed', '{"before":' + ISNULL(@before, 'null') + ',"after":' + @after + '}');
        `),
        { ...entryParams(access, input), id, version }
    );
}

/** The line `e` as JSON for the log, as BEFORE_SQL gives it; `causale` may be another value (the line as it will be) */
const LINE_JSON = (causale: string) => `(SELECT e2.kind, ${TIME_SQL('e2.time_from')} AS timeFrom, ${TIME_SQL('e2.time_to')} AS timeTo, e2.hours, ${causale} AS causale, e2.note
                    FROM timesheet_entries e2 WHERE e2.id = e.id FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES)`;

/**
 * A quick text of Regole Presenze was renamed: every line of these kinds that carries the old text takes the new one
 * (owner, 2026-11-12), each with its log line, the line before and after, like any other change of a line. Runs in the
 * caller's transaction (`run`), together with the rename of the list itself; answers how many lines changed.
 */
export async function renameCausale(run: SqlRunner, access: UserAccess, kinds: readonly EntryKind[], oldTag: string, newTag: string): Promise<number> {
    if (kinds.length === 0) return 0;
    const params: SqlParams = { me: personKey(access), oldTag, newTag };
    const kindList = kinds.map((kind, i) => {
        params[`kind${i}`] = kind;
        return `@kind${i}`;
    });
    const carrying = (alias: string) => `${alias}kind IN (${kindList.join(', ')}) AND ${alias}causale = @oldTag`;
    const result = await run<{ changed: number }>(
        `${LOG_INSERT}
            SELECT @me, e.id, e.operator_code, e.day, 'changed',
                '{"before":' + ISNULL(${LINE_JSON('e2.causale')}, 'null') + ',"after":' + ISNULL(${LINE_JSON('@newTag')}, 'null') + '}'
            FROM timesheet_entries e WHERE ${carrying('e.')};
            UPDATE timesheet_entries SET causale = @newTag, updated_at = GETDATE(), updated_by = @me WHERE ${carrying('')};
            SELECT @@ROWCOUNT AS changed;`,
        params,
        'QUOTES'
    );
    return result.recordset[0]?.changed ?? 0;
}

export async function deleteEntry(access: UserAccess, id: number, version: string): Promise<void> {
    await rows(
        transaction(`
            DECLARE @before NVARCHAR(MAX) = ${BEFORE_SQL};
            DECLARE @operatorCode VARCHAR(20), @day DATE;
            SELECT @operatorCode = operator_code, @day = day FROM timesheet_entries WHERE id = @id;
            DELETE FROM timesheet_entries WHERE id = @id AND ${VERSION_MATCH()};
            ${THROW_IF_STALE}
            ${LOG_INSERT} VALUES (@me, @id, @operatorCode, @day, 'deleted', '{"before":' + ISNULL(@before, 'null') + '}');
        `),
        { id, version, me: personKey(access) }
    );
}
