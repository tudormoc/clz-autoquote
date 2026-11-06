/**
 * The app-wide log (Registro), writing side: one row of app_log per thing a person did — a change of data with the
 * values before and after, a login, an export. logEvent never throws: a log row that cannot be written is reported on
 * the server console and the action goes on. Table: sql/log/001_create_app_log.sql; reading: src/lib/log/entries.ts.
 * A PIN or a password is never passed here.
 */
import { APP_CONFIG } from '@/config/constants';
import { pageIdOf, type UserAccess } from '@/lib/auth/permissions';
import { SUPERADMIN } from '@/lib/auth/session';
import { queryMSSQL } from '@/lib/mssql';

const LIMITS = APP_CONFIG.LOG;

/** What has no page of its own in the menu: stored in app_log.area as it is */
export const LOG_AREAS = { login: 'login' } as const;

/** Who did it, as the log stores them */
export interface LogPerson {
    /** app_users id as text, 'superadmin', 'system' or 'anonymous' */
    id: string;
    name: string;
}

/** What the scheduler does by itself (the daily automatic exit) */
export const SCHEDULER: LogPerson = { id: 'system', name: 'Scheduler' };

/** A login that failed: nobody is logged in, the name is the one typed */
export const anonymous = (name: string): LogPerson => ({ id: 'anonymous', name });

export const personOf = (access: Pick<UserAccess, 'id' | 'name' | 'superadmin'>): LogPerson => ({
    id: access.superadmin || access.id === null ? SUPERADMIN : String(access.id),
    name: access.name,
});

export type LogOutcome = 'ok' | 'error' | 'refused';

export interface LogEntry {
    /** Where it happened: the page's link from LINKS (stored as the page's id), or one of LOG_AREAS */
    page: string;
    /** What was done: riallinea, created, changed, deleted, login … */
    action: string;
    /** What it was done to: order + commessa, operator + code … */
    entityKind?: string;
    entityId?: string | number;
    /** One line a person can read */
    summary: string;
    /** The full record: { before, after }, or { rows: […] } for a write over several tables */
    details?: unknown;
    outcome?: LogOutcome;
    /** The error text when the outcome is not ok */
    error?: string;
}

const cut = (text: string, length: number) => (text.length > length ? text.slice(0, length) : text);

/** Writes one row of the log. Never throws. */
export async function logEvent(person: LogPerson, entry: LogEntry): Promise<void> {
    try {
        await queryMSSQL(`
            INSERT INTO app_log (person, person_name, area, action, entity_kind, entity_id, summary, details, outcome, error)
            VALUES (@person, @personName, @area, @action, @entityKind, @entityId, @summary, @details, @outcome, @error)
        `, {
            person: person.id,
            personName: cut(person.name || person.id, LIMITS.NAME_LENGTH),
            area: pageIdOf(entry.page) ?? entry.page,
            action: entry.action,
            entityKind: entry.entityKind ?? null,
            entityId: entry.entityId === undefined ? null : cut(String(entry.entityId), LIMITS.ENTITY_LENGTH),
            summary: cut(entry.summary, LIMITS.SUMMARY_LENGTH),
            details: entry.details === undefined ? null : JSON.stringify(entry.details),
            outcome: entry.outcome ?? 'ok',
            error: entry.error ? cut(entry.error, LIMITS.ERROR_LENGTH) : null,
        }, 'QUOTES');
    } catch (error) {
        console.error('Log row not written:', entry.action, entry.summary, error);
    }
}
