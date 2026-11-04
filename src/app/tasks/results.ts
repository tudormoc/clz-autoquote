/**
 * How the Agenda's server actions answer: { success: true, … } or { success: false, error } with a text for the user
 * (the shape and the mechanism are src/lib/appTables.ts, shared with the timesheet). Not a 'use server' file: it is
 * imported by them.
 */

import { attemptWrite, type Result } from '@/lib/appTables';
import { APP_COPY } from '@/locales';

export type { Result, Saved } from '@/lib/appTables';
export { refused } from '@/lib/appTables';

const messages = APP_COPY.tasks.messages;

/** Runs a write (after its access check) and turns any failure into a readable error */
export const attempt = <T extends object>(what: string, write: () => Promise<T>): Promise<Result<T>> =>
    attemptWrite(`Agenda: ${what}`, { stale: messages.stale, notFound: messages.notFound }, write);
