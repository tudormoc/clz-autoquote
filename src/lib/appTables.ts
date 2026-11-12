/**
 * The app's own tables in QUOTES (CLZDWHQANDPROG): the Agenda (tsk_*), the timesheet (timesheet_*). What their SQL
 * layers share. Server only.
 *
 * Values come back from SQL already as text, so no time zone can shift them:
 *   DATE → "YYYY-MM-DD" (DATE_SQL), TIME → "HH:MM" (TIME_SQL), DATETIME2 → "YYYY-MM-DD HH:MM:SS" (MOMENT_SQL),
 *   ROWVERSION → "0x…" (VERSION_SQL), compared back with VERSION_MATCH.
 * Every write runs in one transaction (`transaction`) and fails with THROW_IF_STALE when the row changed meanwhile.
 * People are stored as the login names them (`personKey`): an app_users id as text ('12') or 'superadmin'.
 */

import type { UserAccess } from '@/lib/auth/permissions';
import { SUPERADMIN } from '@/lib/auth/session';
import { queryMSSQL, type SqlParams } from '@/lib/mssql';
import { errorMessage } from '@/lib/utils';
import { APP_COPY } from '@/locales';

const DB = 'QUOTES';

export const DATE_SQL = (column: string) => `CONVERT(char(10), ${column}, 23)`;
export const TIME_SQL = (column: string) => `CONVERT(char(5), ${column}, 108)`;
export const MOMENT_SQL = (column: string) => `CONVERT(char(19), ${column}, 120)`;
export const VERSION_SQL = (column = 'row_version') => `CONVERT(varchar(18), CAST(${column} AS binary(8)), 1)`;
export const VERSION_MATCH = (column = 'row_version') => `${column} = CONVERT(binary(8), CAST(@version AS varchar(18)), 1)`;

/** SQL Server error number of the "changed by someone else" THROW in our batches */
const STALE_ERROR = 50010;
export const THROW_IF_STALE = `IF @@ROWCOUNT = 0 THROW ${STALE_ERROR}, 'stale', 1;`;

/** Wraps statements so they all happen or none does */
export const transaction = (sql: string) => `SET XACT_ABORT ON;\nBEGIN TRANSACTION;\n${sql}\nCOMMIT TRANSACTION;`;

/** A person as the login names them: an app_users id as text ('12') or 'superadmin' */
export type PersonKey = string;

/** Who is acting, as stored in created_by / updated_by / a log's person */
export const personKey = (access: UserAccess): PersonKey => (access.superadmin ? SUPERADMIN : String(access.id));

/** Runs a query and returns its first result set */
export async function rows<T>(sql: string, params: SqlParams = {}): Promise<T[]> {
    return (await queryMSSQL<T>(sql, params, DB)).recordset;
}

/** Runs a batch with several SELECTs and returns all result sets */
export async function rowSets(sql: string, params: SqlParams = {}): Promise<unknown[][]> {
    return (await queryMSSQL(sql, params, DB)).recordsets as unknown as unknown[][];
}

/** The row does not exist, or the person may not see it */
export class NotFound extends Error {
    constructor() {
        super('not found');
    }
}

/** The error a write failed with is our "changed by someone else" */
const isStale = (error: unknown) => (error as { number?: number })?.number === STALE_ERROR;

// ---- How the server actions of these modules answer ----

export type Saved = { success: true } | { success: false; error: string };
export type Result<T> = ({ success: true } & T) | { success: false; error: string };

/** The texts a module answers a failed write with */
export interface WriteTexts {
    /** The row changed meanwhile (THROW_IF_STALE) */
    stale: string;
    /** NotFound */
    notFound: string;
}

/** Runs a read or write (after its access check) and turns any failure into a readable error */
export async function attemptWrite<T extends object>(what: string, texts: WriteTexts, write: () => Promise<T>): Promise<Result<T>> {
    try {
        return { success: true, ...(await write()) };
    } catch (error) {
        if (isStale(error)) return { success: false, error: texts.stale };
        if (error instanceof NotFound) return { success: false, error: texts.notFound };
        console.error(`${what} failed:`, error);
        return { success: false, error: errorMessage(error) };
    }
}

export const refused = <T extends object>(error: string = APP_COPY.common.notAllowed): Result<T> => ({ success: false, error });
