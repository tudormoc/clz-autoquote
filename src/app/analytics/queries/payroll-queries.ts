/**
 * PAYROLL QUERIES (Ore Studio Paghe)
 *
 * Finds and reads the month's production Excel file ("10 Produzione ottobre 2026.xlsx", queries/shared/presence-files.ts)
 * and gives every person's days of the month as the pay studio gets them (src/lib/payroll.ts): production people
 * apart from the interinali, the office people of APP_CONFIG.PAYROLL added empty.
 */

'use server'

import { APP_CONFIG } from '@/config/constants';
import { LINKS } from '@/config/navigation';
import { authorize } from '@/lib/auth/access';
import { monthName } from '@/lib/format';
import { emptyDay, monthDates, peopleOfFile, sortByName, type PayrollData } from '@/lib/payroll';
import { errorMessage } from '@/lib/utils';
import { APP_COPY, fmt } from '@/locales';
import { presenceFileNames, presenceFolder, readFirstSheet } from './shared/presence-files';

const { OFFICE_PEOPLE } = APP_CONFIG.PAYROLL;
const { EXCEL_FOLDERS } = APP_CONFIG.PRESENCE;
const copy = APP_COPY.analytics.payroll;

type PayrollResult = { success: true; data: PayrollData } | { success: false; error: string };

/** A month's hours per person from that month's production file: the Clz e Ufficio sheet and the Interinali sheet */
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

        const dates = monthDates(year, month);
        const { production, interinali } = peopleOfFile(readFirstSheet(folder, fileName), dates);
        const office = sortByName(OFFICE_PEOPLE.map((person) => ({ id: person.id, sarp: person.sarp, name: person.name, days: dates.map(emptyDay) })));

        return { success: true, data: { year, month, fileName, clz: [...production, ...office], interinali } };
    } catch (err) {
        console.error('Error in getPayrollHoursAction:', err);
        return { success: false, error: errorMessage(err) };
    }
}
