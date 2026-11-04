/**
 * The month of one or more people: their lines read once, then each day summed up (src/lib/timesheet/month.ts) with
 * the closed days of the Agenda and the workday of each person. Server only.
 */

import { monthDates } from '@/lib/dateUtils';
import { closedDayChecker, type ClosedDay } from '@/lib/tasks/closedDays';
import { listEntries } from '@/lib/timesheet/db/entries';
import { summarizeMonth } from '@/lib/timesheet/month';
import type { DaySummary, Entry, TimesheetPerson } from '@/lib/timesheet/types';
import type { PresenceRulesConfig } from '@/lib/presence';

export interface MonthSources {
    /** The presence rules: the working days, the quick texts (the workday of each person is already on them) */
    rules: PresenceRulesConfig;
    /** The company closed days of the Agenda */
    closedDays: readonly ClosedDay[];
    /** YYYY-MM-DD */
    today: string;
}

/** Each person's month, by NetPro code */
export async function loadMonth(people: readonly TimesheetPerson[], year: number, month: number, sources: MonthSources): Promise<Map<string, DaySummary[]>> {
    const dates = monthDates(year, month);
    const entries = await listEntries(
        people.map((person) => person.operatorCode),
        dates[0],
        dates[dates.length - 1]
    );
    const byPerson = new Map<string, Entry[]>();
    for (const entry of entries) {
        const list = byPerson.get(entry.operatorCode);
        if (list) list.push(entry);
        else byPerson.set(entry.operatorCode, [entry]);
    }

    const { companyDay } = closedDayChecker(sources.closedDays);
    return new Map(
        people.map((person) => [
            person.operatorCode,
            summarizeMonth(year, month, byPerson.get(person.operatorCode) ?? [], {
                workdayHours: person.workdayHours,
                workingDays: sources.rules.workingDays,
                closedDay: companyDay,
                today: sources.today,
            }),
        ])
    );
}
