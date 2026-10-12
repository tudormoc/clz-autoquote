/**
 * How the Agenda's server actions answer: { success: true, … } or { success: false, error } with a text for the user.
 * Not a 'use server' file: it is imported by them.
 */

import { NotFound, isStale } from '@/lib/tasks/db/shared';
import { errorMessage } from '@/lib/utils';
import { APP_COPY } from '@/locales';

export type Saved = { success: true } | { success: false; error: string };
export type Result<T> = ({ success: true } & T) | { success: false; error: string };

const messages = APP_COPY.tasks.messages;

/** Runs a write (after its access check) and turns any failure into a readable error */
export async function attempt<T extends object>(what: string, write: () => Promise<T>): Promise<Result<T>> {
    try {
        return { success: true, ...(await write()) };
    } catch (error) {
        if (isStale(error)) return { success: false, error: messages.stale };
        if (error instanceof NotFound) return { success: false, error: messages.notFound };
        console.error(`Agenda: ${what} failed:`, error);
        return { success: false, error: errorMessage(error) };
    }
}

export const refused = <T extends object>(error: string = APP_COPY.common.notAllowed): Result<T> => ({ success: false, error });
