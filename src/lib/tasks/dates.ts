/**
 * Calendar-date arithmetic on "YYYY-MM-DD" strings, the way the Agenda stores dates (SQL DATE, no time zone).
 * Done in UTC internally so a daylight-saving change never shifts a day. ISO strings compare correctly with < and >.
 */

const DAY_MS = 86_400_000;

/** "2026-10-16" → milliseconds of that day at 00:00 UTC */
const toMs = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));

const fromMs = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** A real calendar date written as YYYY-MM-DD (not "2026-02-30") */
export function isIsoDate(value: unknown): value is string {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && fromMs(toMs(value)) === value;
}

/** The date for year, month (1–12), day; a day past the month's end becomes its last day (31 → 30/04, 29/02 → 28/02) */
export function makeDate(year: number, month: number, day: number): string {
    return fromMs(Date.UTC(year, month - 1, Math.min(day, daysInMonth(year, month))));
}

export function daysInMonth(year: number, month: number): number {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export const addDays = (iso: string, days: number) => fromMs(toMs(iso) + days * DAY_MS);

/** Whole days from a to b (b later → positive) */
export const daysBetween = (a: string, b: string) => Math.round((toMs(b) - toMs(a)) / DAY_MS);

/** Same day N months later; past the month's end → its last day (31/01 + 1 month = 28/02) */
export function addMonths(iso: string, months: number): string {
    const index = yearOf(iso) * 12 + monthOf(iso) - 1 + months;
    return makeDate(Math.floor(index / 12), (index % 12) + 1, dayOf(iso));
}

export const yearOf = (iso: string) => Number(iso.slice(0, 4));
export const monthOf = (iso: string) => Number(iso.slice(5, 7));
export const dayOf = (iso: string) => Number(iso.slice(8, 10));

/** Months since year 0 (to count "every N months") */
export const monthIndex = (iso: string) => yearOf(iso) * 12 + monthOf(iso) - 1;

/** 1 = Monday … 7 = Sunday */
export function weekdayOf(iso: string): number {
    return new Date(toMs(iso)).getUTCDay() || 7;
}

/** Monday of the date's week */
export const weekStart = (iso: string) => addDays(iso, 1 - weekdayOf(iso));

export const maxDate = (a: string, b: string) => (a > b ? a : b);
export const minDate = (a: string, b: string) => (a < b ? a : b);
