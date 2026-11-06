/**
 * What the day editor sends, checked the same way in the browser (to show the message) and on the server (the real
 * check). Texts of the messages in it.ts → timesheet.messages.
 */

import { z } from 'zod';
import { APP_CONFIG } from '@/config/constants';
import { firstInputProblem } from '@/lib/inputProblem';
import { APP_COPY, fmt } from '@/locales';
import { KIND_SPECS } from './kinds';
import { isStepHours, isStepTime } from './time';
import { ENTRY_KINDS, type EntryInput } from './types';

const { MAX_HOURS, MAX_CAUSALE_LENGTH, MAX_NOTE_LENGTH } = APP_CONFIG.TIMESHEET;
const messages = APP_COPY.timesheet.messages;
const editor = APP_COPY.timesheet.editor;

export const TimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).refine(isStepTime, messages.step);
const HoursSchema = z.number().positive().max(MAX_HOURS).refine(isStepHours, messages.step);

export const EntryInputSchema = z
    .object({
        kind: z.enum(ENTRY_KINDS),
        timeFrom: TimeSchema.nullable(),
        timeTo: TimeSchema.nullable(),
        hours: HoursSchema.nullable(),
        causale: z.string().trim().max(MAX_CAUSALE_LENGTH),
        note: z.string().trim().max(MAX_NOTE_LENGTH),
    })
    .superRefine((input, ctx) => {
        const spec = KIND_SPECS[input.kind];
        if (spec.input === 'times') {
            if (!input.timeFrom) ctx.addIssue({ code: 'custom', message: messages.timeFromRequired, path: ['timeFrom'] });
            if (!input.timeTo) ctx.addIssue({ code: 'custom', message: messages.timeToRequired, path: ['timeTo'] });
            if (input.timeFrom && input.timeTo && input.timeTo <= input.timeFrom) ctx.addIssue({ code: 'custom', message: messages.timeOrder, path: ['timeTo'] });
            if (input.hours !== null) ctx.addIssue({ code: 'custom', path: ['hours'] });
        } else {
            if (input.hours === null) ctx.addIssue({ code: 'custom', message: messages.hoursRequired, path: ['hours'] });
            if (input.timeFrom !== null || input.timeTo !== null) ctx.addIssue({ code: 'custom', path: ['timeFrom'] });
        }
    });

/** The input as it will be saved: trimmed, and only the fields its kind has (a time on a ferie line is dropped) */
export function cleanEntryInput(input: EntryInput): EntryInput {
    const spec = KIND_SPECS[input.kind];
    return {
        kind: input.kind,
        timeFrom: spec.input === 'times' ? input.timeFrom || null : null,
        timeTo: spec.input === 'times' ? input.timeTo || null : null,
        hours: spec.input === 'hours' ? input.hours : null,
        causale: spec.presets ? input.causale.trim() : '',
        note: input.note.trim(),
    };
}

/** Messages written for the user (the others are Zod's own, in English) */
const OWN_MESSAGES = new Set<string>(Object.values(messages));

/** The form field a problem is about, by the name in the data */
const FIELD_LABELS: [string, string][] = [
    ['timeFrom', editor.from],
    ['timeTo', editor.to],
    ['hours', editor.hours],
    ['causale', editor.causale],
    ['note', editor.note],
    ['kind', editor.kind],
];

/** The first problem of an entry as a text for the user, or null when all is fine */
export const inputProblem = (input: unknown): string | null =>
    firstInputProblem(EntryInputSchema, input, { ownMessages: OWN_MESSAGES, labels: FIELD_LABELS, invalid: (label) => fmt(messages.invalid, { detail: label }) });
