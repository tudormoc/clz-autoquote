/**
 * Shared parts of the Agenda's SQL (tables tsk_* in QUOTES = CLZDWHQANDPROG, created by sql/tasks/001_create_tables.sql).
 * Server only. Every write runs in one transaction with its tsk_log line; reads use NOLOCK.
 * The SQL text helpers, the runner and the "changed meanwhile" check come from src/lib/appTables.ts, shared with the
 * other modules that have tables of their own (the timesheet).
 */

import { listAccountNames, listGroups } from '@/lib/auth/accounts';
import type { UserAccess } from '@/lib/auth/permissions';
import { SUPERADMIN, superadminAccount } from '@/lib/auth/session';
import { personKey } from '@/lib/appTables';
import type { SqlParams } from '@/lib/mssql';
import { getTodayDate } from '@/lib/dateUtils';
import type { NamedItem, Person, PersonKey } from '@/lib/tasks/types';
import { APP_COPY } from '@/locales';

export { DATE_SQL, MOMENT_SQL, NotFound, THROW_IF_STALE, TIME_SQL, VERSION_MATCH, VERSION_SQL, isStale, personKey, rowSets, rows, transaction } from '@/lib/appTables';

/** The Agenda itself, for what it does on its own (a missed date replaced by the next one) */
export const SYSTEM_PERSON = 'system';

/** May delete a task for good: the superadmin, or whoever created it (created_by) */
export const mayDelete = (access: UserAccess, createdBy: string) => access.superadmin || createdBy === personKey(access);

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
