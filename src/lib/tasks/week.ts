/**
 * Weeks and month grids of the Agenda's calendar views. Pure, on "YYYY-MM-DD" strings; weeks start on Monday.
 */

import { addDays, daysInMonth, monthOf, weekStart, weekdayOf, yearOf } from '@/lib/tasks/dates';

/** The 7 days of the week that starts on `monday` */
export const weekDays = (monday: string): string[] => Array.from({ length: 7 }, (_, i) => addDays(monday, i));

/** ISO 8601 week number (week 1 holds the year's first Thursday) */
export function isoWeekNumber(iso: string): number {
    const thursday = addDays(iso, 4 - weekdayOf(iso));
    const firstThursday = addDays(`${thursday.slice(0, 4)}-01-04`, 4 - weekdayOf(`${thursday.slice(0, 4)}-01-04`));
    return 1 + Math.round((Date.parse(thursday) - Date.parse(firstThursday)) / (7 * 86_400_000));
}

/** "YYYY-MM" of a date */
export const monthKey = (iso: string) => iso.slice(0, 7);

/** "YYYY-MM" moved by some months */
export function shiftMonth(month: string, by: number): string {
    const index = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + by;
    return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/** The days a month grid shows: from the Monday on or before the 1st to the Sunday on or after the last day */
export function monthGrid(month: string): { start: string; end: string } {
    const first = `${month}-01`;
    const last = `${month}-${String(daysInMonth(yearOf(first), monthOf(first))).padStart(2, '0')}`;
    return { start: weekStart(first), end: addDays(last, 7 - weekdayOf(last)) };
}
