/**
 * A person's timesheet month as the pay studio's file has it (src/lib/payroll.ts): one PayrollPerson with a day per
 * calendar day, the hours of each column, the types of ferie and permesso as the notes; names in capitals like the
 * production rows of the Excel file. Used by Ore Studio Paghe
 * (the office rows) and by the export of Ore Ufficio.
 */

import { APP_CONFIG } from '@/config/constants';
import type { PayrollDay, PayrollPerson } from '@/lib/payroll';
import type { DaySummary, TimesheetPerson } from './types';

const { STUDIO_IDS } = APP_CONFIG.PAYROLL;

/** A column's hours, or nothing when the day has none */
const hoursOrNull = (hours: number) => (hours > 0 ? hours : null);

export function toPayrollDay(summary: DaySummary): PayrollDay {
    const { hours } = summary;
    return {
        date: summary.day,
        ferie: hoursOrNull(hours.ferie),
        causaleFerie: summary.causaleFerie || null,
        permesso: hoursOrNull(hours.permesso),
        causalePermesso: summary.causalePermesso || null,
        malattia: hoursOrNull(hours.malattia),
        ordinarie: hoursOrNull(hours.ordinarie),
        straordinarie: hoursOrNull(hours.straordinarie),
        bancaOre: hoursOrNull(hours.bancaOre),
        bancaOreN1: null,
        bancaOreN: null,
    };
}

/** The person with their month, codes as the studio's file wants them */
export function toPayrollPerson(person: TimesheetPerson, days: readonly DaySummary[]): PayrollPerson {
    return {
        id: STUDIO_IDS[person.operatorCode] ?? null,
        sarp: person.matricola,
        name: person.name.trim().toUpperCase(),
        days: days.map(toPayrollDay),
    };
}
