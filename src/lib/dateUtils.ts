/**
 * Date helpers. Dates travel through the app as local "YYYY-MM-DD" strings;
 * for display use formatDate() from src/lib/format.ts.
 */

/** Local calendar date → "YYYY-MM-DD" (no UTC shift, unlike toISOString) */
export function toIsoDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/** Today's local date in YYYY-MM-DD format */
export function getTodayDate(): string {
    return toIsoDate(new Date());
}

export interface DateRange {
    dateFrom: string;
    dateTo: string;
}

/** The ready-made periods of a date filter ("Periodo" in DateRangeFields), in menu order */
export const DATE_PERIODS = ['thisMonth', 'lastMonth', 'thisYear', 'lastYear', 'last12Months'] as const;
export type DatePeriod = (typeof DATE_PERIODS)[number];

/** The dates of a period as of `today` (local calendar): the current ones run up to today */
export function periodRange(period: DatePeriod, today: Date = new Date()): DateRange {
    const year = today.getFullYear();
    const month = today.getMonth();
    const range = (from: Date, to: Date): DateRange => ({ dateFrom: toIsoDate(from), dateTo: toIsoDate(to) });
    switch (period) {
        case 'thisMonth':
            return range(new Date(year, month, 1), today);
        case 'lastMonth':
            return range(new Date(year, month - 1, 1), new Date(year, month, 0));
        case 'thisYear':
            return range(new Date(year, 0, 1), today);
        case 'lastYear':
            return range(new Date(year - 1, 0, 1), new Date(year - 1, 11, 31));
        case 'last12Months':
            return range(new Date(year - 1, month, today.getDate() + 1), today);
    }
}

/** The period these dates are, as of today, or null when they are not one of DATE_PERIODS */
export function periodOf(dates: DateRange, today: Date = new Date()): DatePeriod | null {
    return DATE_PERIODS.find((period) => {
        const range = periodRange(period, today);
        return range.dateFrom === dates.dateFrom && range.dateTo === dates.dateTo;
    }) ?? null;
}

/** What the analytics reports open with: the current year so far */
export const defaultReportPeriod = (): DateRange => periodRange('thisYear');

/** Monday of ISO week `week` (1 to 53) of `year`: week 1 is the week with 4 January */
export function isoWeekStart(year: number, week: number): Date {
    const jan4 = new Date(year, 0, 4);
    const dayOfWeek = jan4.getDay() || 7; // Sunday (0) → 7
    const monday = new Date(year, 0, 4 - (dayOfWeek - 1));
    monday.setDate(monday.getDate() + (week - 1) * 7);
    return monday;
}

/**
 * A database datetime as mssql returns it (the stored wall-clock time, delivered as UTC)
 * → its unshifted "YYYY-MM-DD" and "HH:MM:SS" parts. null when the value is not a date.
 */
export function dbDateTimeParts(value: Date | string): { date: string; time: string } | null {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const iso = date.toISOString();
    return { date: iso.slice(0, 10), time: iso.slice(11, 19) };
}
