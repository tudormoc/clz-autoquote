/**
 * PAYROLL QUERIES (Ore Studio Paghe)
 *
 * Finds and reads the month's production Excel file ("10 Produzione ottobre 2026.xlsx", queries/shared/presence-files.ts)
 * and gives every person's days of the month as the pay studio gets them (src/lib/payroll.ts): production people
 * apart from the interinali, then the office people from the timesheet (src/lib/timesheet).
 */

'use server'

import { APP_CONFIG } from '@/config/constants';
import { LINKS } from '@/config/navigation';
import { authorize } from '@/lib/auth/access';
import { getTodayDate, monthDates } from '@/lib/dateUtils';
import { monthName } from '@/lib/format';
import { peopleOfFile, sortByName, type PayrollData } from '@/lib/payroll';
import { listClosedDays } from '@/lib/tasks/db/settings';
import { loadMonth } from '@/lib/timesheet/db/month';
import { listTimesheetPeople } from '@/lib/timesheet/db/people';
import { toPayrollPerson } from '@/lib/timesheet/payroll';
import { errorMessage } from '@/lib/utils';
import { APP_COPY, fmt } from '@/locales';
import { loadPresenceRules } from '@/app/presence/presence-db';
import { presenceFileNames, presenceFolder, readFirstSheet } from './shared/presence-files';

const { EXCEL_FOLDERS } = APP_CONFIG.PRESENCE;
const copy = APP_COPY.analytics.payroll;

type PayrollResult = { success: true; data: PayrollData } | { success: false; error: string };

/** A month's hours per person: the Clz e Ufficio sheet (production file, then the timesheet) and the Interinali sheet */
export async function getPayrollHoursAction(year: number, month: number): Promise<PayrollResult> {
    await authorize('view', LINKS.analytics['payroll-hours']);
    try {
        const folder = presenceFolder();
        if (!folder) {
            return { success: false, error: fmt(APP_COPY.analytics.presence.folderNotFound, { folders: EXCEL_FOLDERS.join(' / ') }) };
        }

        // "10 Produzione ottobre 2026.xlsx": the month's number opens the name
        const prefix = `${String(month).padStart(2, '0')} `;
        const fileName = presenceFileNames(folder, year).find((file) => file.startsWith(prefix));
        if (!fileName) {
            return { success: false, error: fmt(copy.noFile, { month: monthName(month), year }) };
        }

        const { production, interinali } = peopleOfFile(readFirstSheet(folder, fileName), monthDates(year, month));

        // The office people: their month as entered in Le mie ore
        const [rules, closedDays] = await Promise.all([loadPresenceRules(), listClosedDays()]);
        const people = await listTimesheetPeople(rules);
        const months = await loadMonth(people, year, month, { rules, closedDays, today: getTodayDate() });
        const office = sortByName(people.map((person) => toPayrollPerson(person, months.get(person.operatorCode) ?? [])));

        return { success: true, data: { year, month, fileName, clz: [...production, ...office], interinali } };
    } catch (err) {
        console.error('Error in getPayrollHoursAction:', err);
        return { success: false, error: errorMessage(err) };
    }
}
