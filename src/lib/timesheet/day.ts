/**
 * What a person's day adds up to. No rule changes what was entered: ordinarie is the sum of the work spans, the other
 * columns the sum of their lines. The one number read from the presence rules is the person's workday, used only to
 * say whether the day is covered (the alert). A company closed day with nothing entered counts as ferie by itself.
 */

import { isoWeekday, normalizeHours } from '@/lib/presence';
import { COVERING_FIELDS, KIND_SPECS } from './kinds';
import { spanHours } from './time';
import { HOUR_FIELDS, type DayHours, type DayStatus, type DaySummary, type Entry, type EntryKind } from './types';

export interface DayContext {
    /** The person's workday hours */
    workdayHours: number;
    /** ISO weekdays (1 = Monday … 7 = Sunday) with a workday to cover: the presence rules' working days */
    workingDays: readonly number[];
    /** The company closed day it is (its name), null when the office is open */
    closedReason: string | null;
    /** YYYY-MM-DD: a day before it that is not covered is an alert, today or later only "pending" */
    today: string;
}

export function emptyHours(): DayHours {
    return Object.fromEntries(HOUR_FIELDS.map((field) => [field, 0])) as DayHours;
}

/** The hours of two days (or a day and a total) added up */
export function addHours(a: DayHours, b: DayHours): DayHours {
    return Object.fromEntries(HOUR_FIELDS.map((field) => [field, normalizeHours(a[field] + b[field])])) as DayHours;
}

/** The types of a kind's lines, each once, joined by a comma ("FESTA") */
function causaleOf(entries: Entry[], kind: EntryKind): string {
    return [...new Set(entries.filter((entry) => entry.kind === kind && entry.causale).map((entry) => entry.causale))].join(', ');
}

export function summarizeDay(day: string, entries: Entry[], ctx: DayContext): DaySummary {
    const hours = emptyHours();
    let open = false;
    for (const entry of entries) {
        const spec = KIND_SPECS[entry.kind];
        if (spec.input === 'times') {
            if (!entry.timeFrom) continue;
            if (!entry.timeTo) {
                open = true;
                continue;
            }
            hours[spec.field] += spanHours(entry.timeFrom, entry.timeTo);
        } else {
            hours[spec.field] += entry.hours ?? 0;
        }
    }

    const workingWeekday = ctx.workingDays.includes(isoWeekday(day));
    // The office is closed and nobody wrote anything: the day is ferie, named after the closed day
    const closedByItself = ctx.closedReason !== null && workingWeekday && entries.length === 0;
    let causaleFerie = causaleOf(entries, 'ferie');
    if (closedByItself) {
        hours.ferie = ctx.workdayHours;
        causaleFerie = ctx.closedReason ?? '';
    }
    for (const field of HOUR_FIELDS) hours[field] = normalizeHours(hours[field]);

    const expected = workingWeekday && ctx.closedReason === null ? ctx.workdayHours : 0;
    const covered = normalizeHours(COVERING_FIELDS.reduce((sum, field) => sum + hours[field], 0));
    const missing = normalizeHours(Math.max(0, expected - covered));

    let status: DayStatus;
    if (open) status = 'open';
    else if (closedByItself) status = 'closed';
    else if (expected === 0 && entries.length === 0) status = 'free';
    else if (missing > 0) status = day < ctx.today ? 'short' : 'pending';
    else status = 'ok';

    return {
        day,
        entries,
        hours,
        causaleFerie,
        causalePermesso: causaleOf(entries, 'permesso'),
        expected,
        missing,
        status,
        closedReason: ctx.closedReason,
    };
}

/** The work line still without an exit, if any (the one Esci closes) */
export const openEntry = (summary: DaySummary): Entry | undefined => summary.entries.find((entry) => entry.kind === 'work' && !entry.timeTo);
