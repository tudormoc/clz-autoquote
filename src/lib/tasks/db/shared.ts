/**
 * Shared parts of the Agenda's SQL (tables tsk_* in QUOTES = CLZDWHQANDPROG, created by sql/tasks/001_create_tables.sql).
 * Server only. Every write runs in one transaction with its tsk_log line; reads use NOLOCK.
 *
 * Values come back from SQL already as text, so no time zone can shift them:
 *   DATE → "YYYY-MM-DD" (DATE_SQL), TIME → "HH:MM" (TIME_SQL), DATETIME2 → "YYYY-MM-DD HH:MM:SS" (MOMENT_SQL),
 *   ROWVERSION → "0x…" (VERSION_SQL), compared back with VERSION_MATCH.
 */

import { listAccountNames, listGroups } from '@/lib/auth/accounts';
import type { UserAccess } from '@/lib/auth/permissions';
import { SUPERADMIN, superadminAccount } from '@/lib/auth/session';
import { queryMSSQL, type SqlParams } from '@/lib/mssql';
import { getTodayDate } from '@/lib/dateUtils';
import type { NamedItem, Person, PersonKey } from '@/lib/tasks/types';
import { APP_COPY } from '@/locales';

export const DB = 'QUOTES';

export const DATE_SQL = (column: string) => `CONVERT(char(10), ${column}, 23)`;
export const TIME_SQL = (column: string) => `CONVERT(char(5), ${column}, 108)`;
export const MOMENT_SQL = (column: string) => `CONVERT(char(19), ${column}, 120)`;
export const VERSION_SQL = (column = 'row_version') => `CONVERT(varchar(18), CAST(${column} AS binary(8)), 1)`;
export const VERSION_MATCH = (column = 'row_version') => `${column} = CONVERT(binary(8), CAST(@version AS varchar(18)), 1)`;

/** SQL Server error number of the "changed by someone else" THROW in our batches */
export const STALE_ERROR = 50010;
export const THROW_IF_STALE = `IF @@ROWCOUNT = 0 THROW ${STALE_ERROR}, 'stale', 1;`;

/** Wraps statements so they all happen or none does */
export const transaction = (sql: string) => `SET XACT_ABORT ON;\nBEGIN TRANSACTION;\n${sql}\nCOMMIT TRANSACTION;`;

/** The Agenda itself, for what it does on its own (a missed date replaced by the next one) */
export const SYSTEM_PERSON = 'system';

/** Who is acting, as stored in created_by / done_by / tsk_log.person */
export const personKey = (access: UserAccess): PersonKey => (access.superadmin ? SUPERADMIN : String(access.id));

/** "Today" for the Agenda: the server's local date */
export const today = () => getTodayDate();

/** A tsk_log line (inside a batch); the parameters @me (person) must be set */
export function logSql(entityKind: string, entityIdSql: string, taskIdSql: string, action: string, detailsParam?: string): string {
    return `INSERT INTO tsk_log (person, entity_kind, entity_id, task_id, action, details)
            VALUES (@me, '${entityKind}', ${entityIdSql}, ${taskIdSql}, '${action}', ${detailsParam ? `@${detailsParam}` : 'NULL'});`;
}

/**
 * Tasks the person may see (WHERE condition on alias t): everything for the superadmin; otherwise the ones they are
 * responsible for or created, the ones shared with one of their groups, the ones visible to all.
 */
export function visibleTasksSql(access: UserAccess, params: SqlParams, alias = 't'): string {
    if (access.superadmin) return '1 = 1';
    params.viewer = personKey(access);
    params.viewerGroups = access.groupIds.join(',');
    return `(${alias}.assignee = @viewer OR ${alias}.created_by = @viewer OR ${alias}.visibility = 'all'
        OR (${alias}.visibility = 'group' AND ${alias}.group_id IN (SELECT TRY_CAST(value AS INT) FROM STRING_SPLIT(@viewerGroups, ','))))`;
}

/** Runs a query and returns its first result set */
export async function rows<T>(sql: string, params: SqlParams = {}): Promise<T[]> {
    return (await queryMSSQL<T>(sql, params, DB)).recordset;
}

/** Runs a batch with several SELECTs and returns all result sets */
export async function rowSets(sql: string, params: SqlParams = {}): Promise<unknown[][]> {
    return (await queryMSSQL(sql, params, DB)).recordsets as unknown as unknown[][];
}

/** Everyone who can be named in the Agenda: the users (also suspended ones, for the history) and the superadmin */
export async function loadPeople(): Promise<(Person & { suspended: boolean })[]> {
    const users = await listAccountNames();
    const admin = superadminAccount();
    return [
        ...(admin ? [{ key: SUPERADMIN, name: admin.name, suspended: false }] : []),
        ...users.map((user) => ({ key: String(user.id), name: user.name, suspended: user.suspended })),
    ];
}

/** Person key → name; a deleted user reads "utente eliminato" */
export function nameResolver(people: Person[]): (key: PersonKey | null | undefined) => string | null {
    const names = new Map<string, string>([...people.map((person): [string, string] => [person.key, person.name]), [SYSTEM_PERSON, APP_COPY.tasks.systemPerson]]);
    return (key) => (key ? names.get(key) ?? APP_COPY.tasks.unknownPerson : null);
}

export async function loadGroupNames(): Promise<NamedItem[]> {
    return (await listGroups()).map(({ id, name }) => ({ id, name }));
}

/** JSON column → value, or the fallback when empty or damaged */
export function parseJson<T>(json: string | null | undefined, fallback: T): T {
    if (!json) return fallback;
    try {
        return JSON.parse(json) as T;
    } catch {
        return fallback;
    }
}

/** The task, occurrence, procedure or contact does not exist, or the person may not see it */
export class NotFound extends Error {
    constructor() {
        super('not found');
    }
}

/** The error a write failed with is our "changed by someone else" */
export const isStale = (error: unknown) => (error as { number?: number })?.number === STALE_ERROR;
