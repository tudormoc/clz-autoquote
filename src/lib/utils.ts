import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { APP_CONFIG } from '@/config/constants';
import { APP_COPY, fmt } from '@/locales';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

/** A failure that is not the person's doing, by what the screen says of it (it.ts → errors.faults) */
export type FaultKind = keyof typeof APP_COPY.errors.faults;

/**
 * A fault of the app or of its setup (a missing key, a value that cannot be), not of what the person did: the screen
 * gets a plain sentence, the log this text.
 */
export class AppFault extends Error {
    name = 'AppFault';
}

const TIMEOUT_CODES = new Set(['ETIMEOUT', 'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT']);
const CONNECTION_CODES = new Set(['ELOGIN', 'ESOCKET', 'ECONNCLOSED', 'ENOTOPEN', 'EINSTLOOKUP', 'ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'EHOSTUNREACH', 'ENETUNREACH', 'EAI_AGAIN', 'EPIPE']);
const FILE_CODES: Record<string, FaultKind> = { EBUSY: 'fileBusy', ENOENT: 'fileMissing', EACCES: 'fileDenied', EPERM: 'fileDenied' };
/** The error classes of the database driver (mssql), by name: this file is also the browser's, which has no driver */
const DATABASE_ERRORS = new Set(['RequestError', 'TransactionError', 'PreparedStatementError', 'ConnectionError', 'MSSQLError']);

const codeOf = (error: unknown): string => {
    const code = (error as { code?: unknown } | null)?.code;
    return typeof code === 'string' ? code : '';
};

/**
 * What kind of technical failure this is, or null for an error the app raised itself with a text for the person
 * (`throw new Error(copy.…)`: a plain Error, no code). Technical is whatever a driver, Node, the browser or the
 * framework throws: they name their errors (RequestError, TypeError …), give them a code (ETIMEOUT, ENOENT …) or, for
 * a server action that broke, a digest in place of the text.
 */
export function faultKind(error: unknown): FaultKind | null {
    if (!(error instanceof Error)) return null;
    const code = codeOf(error) || codeOf(error.cause);
    if (TIMEOUT_CODES.has(code) || error.name === 'TimeoutError') return 'timeout';
    if (CONNECTION_CODES.has(code)) return 'connection';
    if (Object.hasOwn(FILE_CODES, code)) return FILE_CODES[code];
    if (DATABASE_ERRORS.has(error.name)) return error.name === 'ConnectionError' ? 'connection' : 'database';
    return error.name !== 'Error' || code !== '' || 'digest' in error ? 'app' : null;
}

/** The text of anything thrown, as it is: for the server log, the Registro and the scheduler, never for a screen */
export function technicalMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

const logged = new WeakSet<object>();

/** Writes a failure in the log (the server's, or the browser's console) with its cause, once however often it is asked */
export function logFault(what: string, error: unknown): void {
    if (typeof error === 'object' && error !== null) {
        if (logged.has(error)) return;
        logged.add(error);
    }
    console.error(what, error);
}

/**
 * The text of anything thrown, for the screen (`catch (err)` blocks, the answers of the server actions). An error the
 * app raised itself says its own text; a technical failure (database, network, file, a fault in the code) says a plain
 * sentence of it.ts, and its cause is written in the log: the driver's own English text tells the person nothing and
 * tells a stranger how the system is made.
 */
export function errorMessage(error: unknown): string {
    const kind = faultKind(error);
    if (!kind) return technicalMessage(error);
    logFault(`Shown as "${kind}":`, error);
    return fmt(APP_COPY.errors.faults[kind], { name: APP_CONFIG.OWNER_NAME });
}

/** Text for comparing and searching: lower case, accents dropped ("Attività" → "attivita") */
export const foldText = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** `work` on every item, at most `atOnce` running together; the results keep the items' order */
export async function mapAtOnce<T, R>(items: readonly T[], atOnce: number, work: (item: T) => Promise<R>): Promise<R[]> {
    const results = new Array<R>(items.length);
    let next = 0;
    const worker = async () => {
        while (next < items.length) {
            const index = next++;
            results[index] = await work(items[index]);
        }
    };
    await Promise.all(Array.from({ length: Math.min(atOnce, items.length) }, worker));
    return results;
}

/** Copy of `set` with `key` switched on or off */
export function toggleInSet<K>(set: ReadonlySet<K>, key: K): Set<K> {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
}
