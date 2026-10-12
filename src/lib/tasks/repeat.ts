/**
 * Repeat rules of a task, and the dates they give. Pure functions: no database, no React.
 *
 * A rule is stored as JSON in tsk_tasks.repeat_rule (NULL = one-time) and always read through RepeatRuleSchema,
 * so a new kind of rule needs no database change. Two modes:
 *   - calendar: the dates follow the calendar (every month on the 16th), whatever happens to the earlier ones;
 *   - after:    the next date is counted from when the last one was done (3 months after the last check).
 * The task's first date (tsk_tasks.due_date) anchors the rule: "every 2 weeks" counts from its week,
 * "every 3 months" from its month.
 */

import { z } from 'zod';
import { addDays, addMonths, daysInMonth, isIsoDate, makeDate, maxDate, monthIndex, weekStart, weekdayOf, yearOf } from '@/lib/tasks/dates';
import { APP_COPY } from '@/locales';

const messages = APP_COPY.tasks.messages;

const IsoDateSchema = z.string().refine(isIsoDate);
const WeekdaySchema = z.number().int().min(1).max(7);
const count = (max: number) => z.number().int().min(1).max(max);

/** Which day(s) of the month */
const MonthDaySchema = z.discriminatedUnion('type', [
    /** These days (1–31; past a month's end = its last day) */
    z.object({ type: z.literal('days'), days: z.array(z.number().int().min(1).max(31)).min(1, messages.monthDaysRequired).max(31) }),
    z.object({ type: z.literal('last') }),
    /** The nth weekday: first Monday (1, 1), last Friday (-1, 5) */
    z.object({ type: z.literal('weekday'), nth: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(-1)]), weekday: WeekdaySchema }),
]);

const PatternSchema = z.discriminatedUnion('unit', [
    z.object({ unit: z.literal('days'), every: count(366) }),
    z.object({ unit: z.literal('weeks'), every: count(52), weekdays: z.array(WeekdaySchema).min(1, messages.weekdaysRequired).max(7) }),
    z.object({ unit: z.literal('months'), every: count(24), on: MonthDaySchema }),
    /** Every N years on one or more dates (16/06 and 16/12) */
    z.object({ unit: z.literal('years'), every: count(10), dates: z.array(z.object({ month: count(12), day: count(31) })).min(1, messages.yearDatesRequired).max(24) }),
]);

const EndSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('never') }),
    z.object({ type: z.literal('until'), date: IsoDateSchema }),
    z.object({ type: z.literal('count'), count: count(1000) }),
]);

export const INTERVAL_UNITS = ['days', 'weeks', 'months', 'years'] as const;
export type IntervalUnit = (typeof INTERVAL_UNITS)[number];

export const RepeatRuleSchema = z.discriminatedUnion('mode', [
    z.object({
        mode: z.literal('calendar'),
        pattern: PatternSchema,
        /** A date that passed undone: keep it open (nothing lost) or let the next one replace it (a weekly check) */
        missed: z.enum(['keep', 'latest']),
        end: EndSchema,
    }),
    z.object({
        mode: z.literal('after'),
        every: count(366),
        unit: z.enum(INTERVAL_UNITS),
        end: EndSchema,
    }),
]);

export type RepeatRule = z.infer<typeof RepeatRuleSchema>;
export type RepeatPattern = z.infer<typeof PatternSchema>;
export type MonthDay = z.infer<typeof MonthDaySchema>;
export type RepeatEnd = z.infer<typeof EndSchema>;
export type CalendarRule = Extract<RepeatRule, { mode: 'calendar' }>;
export type AfterRule = Extract<RepeatRule, { mode: 'after' }>;

/** The stored JSON as a rule; null for a one-time task or a value that is not a valid rule */
export function parseRepeatRule(json: string | null | undefined): RepeatRule | null {
    if (!json) return null;
    try {
        const parsed = RepeatRuleSchema.safeParse(JSON.parse(json));
        return parsed.success ? parsed.data : null;
    } catch {
        return null;
    }
}

/** Date of the nth weekday of a month (nth -1 = the last one) */
function nthWeekday(year: number, month: number, nth: number, weekday: number): string {
    if (nth === -1) {
        const last = makeDate(year, month, daysInMonth(year, month));
        return addDays(last, -((weekdayOf(last) - weekday + 7) % 7));
    }
    const first = makeDate(year, month, 1);
    return addDays(first, ((weekday - weekdayOf(first) + 7) % 7) + (nth - 1) * 7);
}

/** The days a month gives for "on" (sorted, without doubles: 30 and 31 are the same day in April) */
function monthDays(year: number, month: number, on: MonthDay): string[] {
    if (on.type === 'last') return [makeDate(year, month, daysInMonth(year, month))];
    if (on.type === 'weekday') return [nthWeekday(year, month, on.nth, on.weekday)];
    return Array.from(new Set(on.days.map((day) => makeDate(year, month, day)))).sort();
}

/** One step of the pattern: the period number `step` after the anchor's, and the dates it holds */
function periodDates(pattern: RepeatPattern, anchor: string, step: number): string[] {
    switch (pattern.unit) {
        case 'days':
            return [addDays(anchor, step * pattern.every)];
        case 'weeks': {
            const monday = addDays(weekStart(anchor), step * pattern.every * 7);
            return Array.from(new Set(pattern.weekdays)).sort((a, b) => a - b).map((weekday) => addDays(monday, weekday - 1));
        }
        case 'months': {
            const index = monthIndex(anchor) + step * pattern.every;
            return monthDays(Math.floor(index / 12), (index % 12) + 1, pattern.on);
        }
        case 'years': {
            const year = yearOf(anchor) + step * pattern.every;
            return Array.from(new Set(pattern.dates.map((date) => makeDate(year, date.month, date.day)))).sort();
        }
    }
}

/** How many periods lie between the anchor and `from` (a safe first step to look at, never past `from`) */
function firstStep(pattern: RepeatPattern, anchor: string, from: string): number {
    if (from <= anchor) return 0;
    const days = (Date.parse(from) - Date.parse(anchor)) / 86_400_000;
    // Longest possible period, so the step is never past `from`; the dates before `from` are skipped anyway
    const periodDays = { days: 1, weeks: 7, months: 31, years: 366 }[pattern.unit] * pattern.every;
    return Math.max(0, Math.floor(days / periodDays) - 2);
}

/**
 * The pattern's dates from `from` to `to` (both included), never before the anchor, at most `limit` of them.
 * The anchor is the task's first date.
 */
export function patternDates(pattern: RepeatPattern, anchor: string, from: string, to: string, limit = 500): string[] {
    const start = maxDate(from, anchor);
    const dates: string[] = [];
    for (let step = firstStep(pattern, anchor, start); dates.length < limit; step++) {
        const period = periodDates(pattern, anchor, step);
        if (period[0] > to) break;
        for (const date of period) {
            if (date >= start && date <= to && dates.length < limit) dates.push(date);
        }
    }
    return dates;
}

/** The first date of the pattern after `after` (not on it), never before the anchor */
export function nextPatternDate(pattern: RepeatPattern, anchor: string, after: string): string | null {
    // The longest gap between two dates is one period (up to 10 years): look one period plus a year ahead
    const span = { days: pattern.every + 1, weeks: pattern.every * 7 + 7, months: pattern.every * 31 + 366, years: pattern.every * 366 + 366 }[pattern.unit];
    return patternDates(pattern, anchor, addDays(after, 1), addDays(after, span), 1)[0] ?? null;
}

/** "after" mode: the date `every` units after `from` */
export function addInterval(from: string, every: number, unit: IntervalUnit): string {
    switch (unit) {
        case 'days':
            return addDays(from, every);
        case 'weeks':
            return addDays(from, every * 7);
        case 'months':
            return addMonths(from, every);
        case 'years':
            return addMonths(from, every * 12);
    }
}

/** The rule allows another date: before its end date, and fewer than its count when `made` dates exist already */
export function withinEnd(end: RepeatEnd, date: string, made: number): boolean {
    if (end.type === 'until') return date <= end.date;
    if (end.type === 'count') return made < end.count;
    return true;
}
