/** A person's month: one summary per calendar day, and the month's totals. */

import { monthDates } from '@/lib/dateUtils';
import { addHours, emptyHours, summarizeDay } from './day';
import type { DayHours, DaySummary, Entry } from './types';

export interface MonthContext {
    workdayHours: number;
    workingDays: readonly number[];
    /** The company closed day a date is (its name), null when the office is open */
    closedDay: (day: string) => string | null;
    today: string;
    /** YYYY-MM-DD, the first day of the timesheet (Regole Presenze) */
    startDay: string;
}

function groupEntries(entries: Entry[], keyOf: (entry: Entry) => string): Map<string, Entry[]> {
    const groups = new Map<string, Entry[]>();
    for (const entry of entries) {
        const key = keyOf(entry);
        const list = groups.get(key);
        if (list) list.push(entry);
        else groups.set(key, [entry]);
    }
    return groups;
}

/** The month's entries grouped by day */
export const entriesByDay = (entries: Entry[]): Map<string, Entry[]> => groupEntries(entries, (entry) => entry.day);

/** Entries of several people grouped by person */
export const entriesByPerson = (entries: Entry[]): Map<string, Entry[]> => groupEntries(entries, (entry) => entry.operatorCode);

export function summarizeMonth(year: number, month: number, entries: Entry[], ctx: MonthContext): DaySummary[] {
    const byDay = entriesByDay(entries);
    return monthDates(year, month).map((day) =>
        summarizeDay(day, byDay.get(day) ?? [], {
            workdayHours: ctx.workdayHours,
            workingDays: ctx.workingDays,
            closedReason: ctx.closedDay(day),
            today: ctx.today,
            startDay: ctx.startDay,
        })
    );
}

/** Every working day of the month is covered and none is still open: the quiet "Mese completo" mark */
export function monthComplete(days: readonly DaySummary[]): boolean {
    const working = days.filter((day) => day.expected > 0);
    return working.length > 0 && working.every((day) => day.missing === 0 && day.status !== 'open');
}

/** The hours of every column added up over the days */
export function totalHours(days: readonly DaySummary[]): DayHours {
    return days.reduce((total, day) => addHours(total, day.hours), emptyHours());
}
