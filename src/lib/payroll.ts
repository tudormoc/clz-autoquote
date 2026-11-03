/**
 * Ore Studio Paghe: the month's hours of every person as the pay studio gets them, read from the monthly production
 * Excel file (src/app/analytics/queries/payroll-queries.ts reads the file, the rest is here, pure): the people of
 * the file's rows, the days of a month, the order of the people, the rows of the table and of the Excel sheets
 * (empty rows between people).
 */

import { APP_CONFIG } from '@/config/constants';
import { hasNameMark } from '@/lib/presence/categories';

const { EXCEL_COLUMNS: COL, INTERINALI_GROUP, PLACEHOLDER_NAME_PREFIX, BLANK_ROWS_BETWEEN_PEOPLE } = APP_CONFIG.PAYROLL;

/** A cell as the studio gets it: a number of hours, a typed note ("L.104"), or nothing */
export type PayrollValue = number | string | null;

/** The hour columns, in the order of the file */
export const PAYROLL_FIELDS = ['ferie', 'permesso', 'malattia', 'ordinarie', 'straordinarie', 'bancaOre', 'bancaOreN1', 'bancaOreN'] as const;
export type PayrollField = (typeof PAYROLL_FIELDS)[number];

export type PayrollDay = { date: string } & Record<PayrollField, PayrollValue>;

export interface PayrollPerson {
    /** NetPro operator code ("ID Operatore"), as in the file */
    id: string | null;
    /** NetPro matricola ("Codice SARP net"), as in the file */
    sarp: string | null;
    name: string;
    /** One entry per day of the month, in order */
    days: PayrollDay[];
}

export interface PayrollData {
    year: number;
    month: number;
    /** The production file the hours come from */
    fileName: string;
    /** Production people A–Z, then the office people A–Z (empty, filled by hand) */
    clz: PayrollPerson[];
    interinali: PayrollPerson[];
}

/** A row of the table and of the sheet: a person's day, or one of the empty rows between people */
export type PayrollRow = { kind: 'day'; person: PayrollPerson; day: PayrollDay } | { kind: 'blank'; key: string };

/** A day with nothing in it */
export function emptyDay(date: string): PayrollDay {
    return { date, ferie: null, permesso: null, malattia: null, ordinarie: null, straordinarie: null, bancaOre: null, bancaOreN1: null, bancaOreN: null };
}

/** Every day of a month as "YYYY-MM-DD" */
export function monthDates(year: number, month: number): string[] {
    const days = new Date(year, month, 0).getDate();
    const prefix = `${year}-${String(month).padStart(2, '0')}-`;
    return Array.from({ length: days }, (_, i) => `${prefix}${String(i + 1).padStart(2, '0')}`);
}

/** People A–Z by name, upper and lower case alike */
export function sortByName<T extends { name: string }>(people: T[]): T[] {
    return [...people].sort((a, b) => a.name.localeCompare(b.name, APP_CONFIG.LOCALE.LANGUAGE, { sensitivity: 'base' }));
}

/** The days of every person, with BLANK_ROWS_BETWEEN_PEOPLE empty rows between one person and the next */
export function payrollRows(people: PayrollPerson[]): PayrollRow[] {
    const rows: PayrollRow[] = [];
    people.forEach((person, index) => {
        if (index > 0) {
            for (let i = 0; i < BLANK_ROWS_BETWEEN_PEOPLE; i++) rows.push({ kind: 'blank', key: `${person.name}_blank_${i}` });
        }
        for (const day of person.days) rows.push({ kind: 'day', person, day });
    });
    return rows;
}

// ---- The people of a production file (its rows as arrays, header row first) ----

/** A cell as the studio gets it: a number, a typed note ("L.104"), or nothing */
function cellValue(raw: unknown): PayrollValue {
    if (typeof raw === 'number') return Number.isNaN(raw) ? null : raw;
    const text = String(raw ?? '').trim();
    return text || null;
}

/** A code cell as text ("73"), nothing when empty */
function cellText(raw: unknown): string | null {
    const text = String(raw ?? '').trim();
    return text || null;
}

/** Days from 1899-12-30, Excel's day zero, to 1970-01-01 */
const UNIX_EPOCH_SERIAL = 25569;
const DAY_MS = 86_400_000;

/** "YYYY-MM-DD" of an Excel date serial (its time part dropped); null for anything else (the file's "data0" rows) */
export function cellDate(raw: unknown): string | null {
    if (typeof raw !== 'number' || Number.isNaN(raw)) return null;
    return new Date((Math.floor(raw) - UNIX_EPOCH_SERIAL) * DAY_MS).toISOString().slice(0, 10);
}

interface FoundPerson {
    person: Omit<PayrollPerson, 'days'>;
    interinale: boolean;
    byDate: Map<string, PayrollDay>;
}

/**
 * The people of the file with their days of the month (`dates`), production and interinali apart, each A–Z:
 * a row counts when it has a name and a date of the month; the hour cells are copied as they are; the spare
 * "ZZZRISERVA" rows are left out; a person is an interinale by the group column or the mark on the name.
 */
export function peopleOfFile(rows: unknown[][], dates: string[]): { production: PayrollPerson[]; interinali: PayrollPerson[] } {
    const inMonth = new Set(dates);
    const found = new Map<string, FoundPerson>();

    for (const row of rows.slice(1)) {
        const name = String(row[COL.NAME] ?? '').trim();
        const date = cellDate(row[COL.DATE]);
        if (!name || name.toUpperCase().startsWith(PLACEHOLDER_NAME_PREFIX) || !date || !inMonth.has(date)) continue;

        const key = name.toUpperCase();
        let entry = found.get(key);
        if (!entry) {
            entry = {
                person: { id: cellText(row[COL.ID]), sarp: cellText(row[COL.SARP]), name },
                interinale: String(row[COL.GROUP] ?? '').trim() === INTERINALI_GROUP || hasNameMark(name),
                byDate: new Map(),
            };
            found.set(key, entry);
        }
        entry.byDate.set(date, {
            date,
            ferie: cellValue(row[COL.FERIE]),
            permesso: cellValue(row[COL.PERMESSO]),
            malattia: cellValue(row[COL.MALATTIA]),
            ordinarie: cellValue(row[COL.ORDINARIE]),
            straordinarie: cellValue(row[COL.STRAORDINARIE]),
            bancaOre: cellValue(row[COL.BANCA_ORE]),
            bancaOreN1: cellValue(row[COL.BANCA_ORE_N1]),
            bancaOreN: cellValue(row[COL.BANCA_ORE_N]),
        });
    }

    const people = (interinale: boolean) =>
        sortByName(
            [...found.values()]
                .filter((entry) => entry.interinale === interinale)
                .map(({ person, byDate }) => ({ ...person, days: dates.map((date) => byDate.get(date) ?? emptyDay(date)) }))
        );
    return { production: people(false), interinali: people(true) };
}
