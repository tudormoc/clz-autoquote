/**
 * Days the office is closed: the weekdays in APP_CONFIG.TASKS.CLOSED_WEEKDAYS and the company's own closed days
 * (tsk_closed_days, Impostazioni → Giorni di chiusura). Nothing else is premade: holidays are entered there.
 * A due date is never moved: when it falls on a closed day the Agenda suggests the working day before.
 */

import { APP_CONFIG } from '@/config/constants';
import { addDays, weekdayOf } from '@/lib/tasks/dates';
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

/** Answers "is the office closed on this day, and why" for one list of company closed days */
export function closedDayChecker(closedDays: readonly ClosedDay[]) {
    const exact = new Map(closedDays.filter((day) => !day.everyYear).map((day) => [day.closedOn, day.name]));
    const yearly = new Map(closedDays.filter((day) => day.everyYear).map((day) => [day.closedOn.slice(5), day.name]));

    /** The company closed day this date is (its name in Giorni di chiusura), or null: weekends are not counted here */
    const companyDay = (iso: string): string | null => exact.get(iso) ?? yearly.get(iso.slice(5)) ?? null;

    /** Why the office is closed on this date (company day name, or "weekend"), or null when open */
    const reason = (iso: string): string | null =>
        companyDay(iso) ??
        ((APP_CONFIG.TASKS.CLOSED_WEEKDAYS as readonly number[]).includes(weekdayOf(iso)) ? holidays.weekend : null);

    /** The last working day before a closed date (the date itself when the office is open) */
    const workingDayOnOrBefore = (iso: string): string => {
        let day = iso;
        // A month of closed days in a row is a mistake in the list: stop rather than loop
        for (let i = 0; i < 31 && reason(day) !== null; i++) day = addDays(day, -1);
        return day;
    };

    return { companyDay, reason, workingDayOnOrBefore };
}

export type ClosedDayChecker = ReturnType<typeof closedDayChecker>;
