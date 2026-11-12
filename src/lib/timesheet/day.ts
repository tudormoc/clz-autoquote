/**
 * What a person's day adds up to. No rule changes what was entered: ordinarie is the sum of the work spans, the other
 * columns the sum of their lines. The one number read from the presence rules is the person's workday, used only to
 * say whether the day is covered (the alert). A company closed day with nothing entered counts as ferie by itself.
 */

import { weekdayOf } from '@/lib/dateUtils';
import { normalizeHours } from '@/lib/presence';
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
    /** YYYY-MM-DD, the first day of the timesheet (Regole Presenze): a day before it is shown but expects nothing */
    startDay: string;
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

/** The hours one line adds towards the day's coverage (an open work line adds nothing yet) */
export function entryCoverage(entry: Entry): number {
    const spec = KIND_SPECS[entry.kind];
    if (!spec.covers) return 0;
    if (spec.input === 'times') return entry.timeFrom && entry.timeTo ? spanHours(entry.timeFrom, entry.timeTo) : 0;
    return entry.hours ?? 0;
}

/**
 * The hours still needed to reach the person's workday, whatever the day is — a Saturday or a day ahead counts the
 * same (owner, 2026-11-06). The line being changed is counted out through `excluding`.
 */
export function remainingToWorkday(entries: readonly Entry[], workdayHours: number, excluding: Entry | null = null): number {
    const covered = entries.reduce((sum, entry) => sum + (entry.id === excluding?.id ? 0 : entryCoverage(entry)), 0);
    return normalizeHours(Math.max(0, workdayHours - covered));
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

    // Before the start of the timesheet a day is shown but expects nothing and takes nothing (owner, 2026-11-05)
    const workingWeekday = day >= ctx.startDay && ctx.workingDays.includes(weekdayOf(day));
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
