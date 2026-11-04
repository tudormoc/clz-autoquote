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
}

/** The month's entries grouped by day */
export function entriesByDay(entries: Entry[]): Map<string, Entry[]> {
    const byDay = new Map<string, Entry[]>();
    for (const entry of entries) {
        const list = byDay.get(entry.day);
        if (list) list.push(entry);
        else byDay.set(entry.day, [entry]);
    }
    return byDay;
}

export function summarizeMonth(year: number, month: number, entries: Entry[], ctx: MonthContext): DaySummary[] {
    const byDay = entriesByDay(entries);
    return monthDates(year, month).map((day) =>
        summarizeDay(day, byDay.get(day) ?? [], {
            workdayHours: ctx.workdayHours,
            workingDays: ctx.workingDays,
            closedReason: ctx.closedDay(day),
            today: ctx.today,
        })
    );
}

/** The hours of every column added up over the days */
export function totalHours(days: readonly DaySummary[]): DayHours {
    return days.reduce((total, day) => addHours(total, day.hours), emptyHours());
}
