/**
 * Days the office is closed: the weekdays in APP_CONFIG.TASKS.CLOSED_WEEKDAYS, Italian national holidays (worked out
 * here, Easter included) and the company's own closed days (tsk_closed_days, Impostazioni → Giorni di chiusura).
 * A due date is never moved: when it falls on a closed day the Agenda suggests the working day before.
 */

import { APP_CONFIG } from '@/config/constants';
import { addDays, makeDate, weekdayOf, yearOf } from '@/lib/tasks/dates';
import { APP_COPY } from '@/locales';

const holidays = APP_COPY.tasks.holidays;

/** A company closed day as stored */
export interface ClosedDay {
    id: number;
    /** YYYY-MM-DD */
    closedOn: string;
    name: string;
    /** Same day and month every year (patron saint) rather than only that date */
    everyYear: boolean;
}

/** National holidays with a fixed day: "MM-DD" → name */
const FIXED_HOLIDAYS: Record<string, string> = {
    '01-01': holidays.newYear,
    '01-06': holidays.epiphany,
    '04-25': holidays.liberation,
    '05-01': holidays.labour,
    '06-02': holidays.republic,
    '08-15': holidays.assumption,
    '11-01': holidays.allSaints,
    '12-08': holidays.immaculate,
    '12-25': holidays.christmas,
    '12-26': holidays.stStephen,
};

/** Easter Sunday of a year (Gregorian calendar, anonymous algorithm) */
export function easterSunday(year: number): string {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return makeDate(year, month, day);
}

/** Name of the national holiday on this date, or null */
export function nationalHoliday(iso: string): string | null {
    const fixed = FIXED_HOLIDAYS[iso.slice(5)];
    if (fixed) return fixed;
    const easter = easterSunday(yearOf(iso));
    if (iso === easter) return holidays.easter;
    if (iso === addDays(easter, 1)) return holidays.easterMonday;
    return null;
}

/** Answers "is the office closed on this day, and why" for one list of company closed days */
export function closedDayChecker(closedDays: readonly ClosedDay[]) {
    const exact = new Map(closedDays.filter((day) => !day.everyYear).map((day) => [day.closedOn, day.name]));
    const yearly = new Map(closedDays.filter((day) => day.everyYear).map((day) => [day.closedOn.slice(5), day.name]));

    /** Why the office is closed on this date (holiday or company day name, or "weekend"), or null when open */
    const reason = (iso: string): string | null =>
        nationalHoliday(iso) ??
        exact.get(iso) ??
        yearly.get(iso.slice(5)) ??
        ((APP_CONFIG.TASKS.CLOSED_WEEKDAYS as readonly number[]).includes(weekdayOf(iso)) ? holidays.weekend : null);

    /** The last working day before a closed date (the date itself when the office is open) */
    const workingDayOnOrBefore = (iso: string): string => {
        let day = iso;
        // A month of closed days in a row is a mistake in the list: stop rather than loop
        for (let i = 0; i < 31 && reason(day) !== null; i++) day = addDays(day, -1);
        return day;
    };

    return { reason, workingDayOnOrBefore };
}

export type ClosedDayChecker = ReturnType<typeof closedDayChecker>;
