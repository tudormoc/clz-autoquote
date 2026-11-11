/**
 * The "giornata normale": the work spans one click writes into an empty day, one day at a time (owner, 2026-11-05:
 * never several days together). It is only ever learned, never invented (owner, 2026-11-05): the shape the
 * person's own full days take most often, a full day being closed work lines that add up to exactly their workday
 * (owner, 2026-11-11). Until such a day exists there is no suggestion.
 * Pure; the reads and writes are in timesheet-actions.ts.
 */

import { APP_CONFIG } from '@/config/constants';
import { minutesToTime, timeToMinutes } from '@/lib/presence';
import { APP_COPY, fmt } from '@/locales';
import { entriesByDay } from './month';
import type { Entry, EntryInput, NormalDay, WorkSpan } from './types';

/** The spans' length in minutes (whole numbers, so two totals compare exactly) */
const minutesOf = (spans: readonly WorkSpan[]) => spans.reduce((sum, span) => sum + timeToMinutes(span.to) - timeToMinutes(span.from), 0);

/** The spans as one text, to tell two shapes of a day apart */
const shapeKey = (spans: readonly WorkSpan[]) => spans.map((span) => `${span.from}-${span.to}`).join(' ');

/** The closed work spans of a day's lines, in time order */
export const workSpans = (entries: readonly Entry[]): WorkSpan[] =>
    entries
        .flatMap((entry) => (entry.kind === 'work' && entry.timeFrom && entry.timeTo ? [{ from: entry.timeFrom, to: entry.timeTo }] : []))
        .sort((a, b) => a.from.localeCompare(b.from));

/** A proposed span for a new work line: Alle stays open when the day misses nothing */
export interface SpanSuggestion {
    from: string;
    to: string | null;
}

/**
 * Where the next work line of a day starts: a break after the last exit, ending when the day is covered (owner,
 * 2026-11-05: 08:30–12:30 saved, an 8 h person's next line proposes 13:30–17:30). Nothing to propose while the
 * day has no closed work line, or when the break would pass the last pick of the day.
 */
export function nextWorkSpan(entries: readonly Entry[], missingHours: number, lastTime: string): SpanSuggestion | null {
    const spans = workSpans(entries);
    if (spans.length === 0) return null;
    const lastTo = spans.reduce((latest, span) => (span.to > latest ? span.to : latest), spans[0].to);
    const from = timeToMinutes(lastTo) + APP_CONFIG.TIMESHEET.NEXT_LINE_BREAK_MINUTES;
    const last = timeToMinutes(lastTime);
    if (from >= last) return null;
    return { from: minutesToTime(from), to: missingHours > 0 ? minutesToTime(Math.min(from + missingHours * 60, last)) : null };
}

/**
 * The person's normal day: the shape their full days take most often among the days given (the lookback). A day
 * counts when its closed work lines add up to exactly the workday: a longer day is an exception the person corrects
 * by hand each time and never becomes the suggestion (owner, 2026-11-11), a day with an open line or shortened by
 * permesso or ferie does not count either. Between shapes seen equally often the most recent one wins. Nothing
 * learned yet: no spans, and the chip stays hidden.
 */
export function normalDayOf(entries: readonly Entry[], workdayHours: number): NormalDay {
    const workdayMinutes = Math.round(workdayHours * 60);
    const shapes = new Map<string, { spans: WorkSpan[]; days: number; lastDay: string }>();
    for (const [day, dayEntries] of entriesByDay([...entries])) {
        if (dayEntries.some((entry) => entry.kind === 'work' && !entry.timeTo)) continue;
        const spans = workSpans(dayEntries);
        if (workdayMinutes <= 0 || minutesOf(spans) !== workdayMinutes) continue;
        const seen = shapes.get(shapeKey(spans));
        if (!seen) shapes.set(shapeKey(spans), { spans, days: 1, lastDay: day });
        else {
            seen.days += 1;
            if (day > seen.lastDay) seen.lastDay = day;
        }
    }
    const usual = [...shapes.values()].sort((a, b) => b.days - a.days || b.lastDay.localeCompare(a.lastDay))[0];
    return usual ? { spans: usual.spans, hours: workdayHours } : { spans: [], hours: 0 };
}

/** The lines Giornata normale writes */
export const normalDayInputs = (normal: NormalDay): EntryInput[] =>
    normal.spans.map((span) => ({ kind: 'work', timeFrom: span.from, timeTo: span.to, hours: null, causale: '', note: '' }));

/** "08:00–12:00, 13:00–17:00" */
export const spansText = (spans: readonly WorkSpan[]) => spans.map((span) => fmt(APP_COPY.timesheet.day.span, { from: span.from, to: span.to })).join(', ');
