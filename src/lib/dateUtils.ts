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

/** Local date and time → "YYYY-MM-DD HH:MM:SS", the wall-clock text NetPro stores (no time zone can shift it) */
export function toLocalDateTime(date: Date): string {
    const two = (n: number) => String(n).padStart(2, '0');
    return `${toIsoDate(date)} ${two(date.getHours())}:${two(date.getMinutes())}:${two(date.getSeconds())}`;
}

export interface DateRange {
    dateFrom: string;
    dateTo: string;
}

/** The ready-made periods of a date filter ("Periodo" in DateRangeFields), in menu order */
export const DATE_PERIODS = ['lastWeek', 'lastMonth', 'lastYear'] as const;
export type DatePeriod = (typeof DATE_PERIODS)[number];

/** The dates of a period as of `today` (local calendar): whole weeks, months and years already over */
export function periodRange(period: DatePeriod, today: Date = new Date()): DateRange {
    const year = today.getFullYear();
    const month = today.getMonth();
    const range = (from: Date, to: Date): DateRange => ({ dateFrom: toIsoDate(from), dateTo: toIsoDate(to) });
    switch (period) {
        case 'lastWeek': {
            // Monday to Sunday of the week before this one (the Monday may fall in the month before)
            const monday = new Date(year, month, today.getDate() - (today.getDay() || 7) + 1 - 7);
            return range(monday, new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6));
        }
        case 'lastMonth':
            return range(new Date(year, month - 1, 1), new Date(year, month, 0));
        case 'lastYear':
            return range(new Date(year - 1, 0, 1), new Date(year - 1, 11, 31));
    }
}

/** The years a year filter offers: this one and the `count - 1` before it, newest first */
export function recentYears(count: number, today: Date = new Date()): number[] {
    return Array.from({ length: count }, (_, i) => today.getFullYear() - i);
}

/** The period these dates are, as of today, or null when they are not one of DATE_PERIODS */
export function periodOf(dates: DateRange, today: Date = new Date()): DatePeriod | null {
    return DATE_PERIODS.find((period) => {
        const range = periodRange(period, today);
        return range.dateFrom === dates.dateFrom && range.dateTo === dates.dateTo;
    }) ?? null;
}

/** What a date filter opens with: today, as a calendar does ("Personalizzato"); the periods are one pick away */
export const defaultReportPeriod = (): DateRange => ({ dateFrom: getTodayDate(), dateTo: getTodayDate() });

/** A month of a year, as the month pickers hold it */
export interface MonthPeriod {
    year: number;
    /** 1–12 */
    month: number;
}

export const thisMonthPeriod = (today: Date = new Date()): MonthPeriod => ({ year: today.getFullYear(), month: today.getMonth() + 1 });

export const sameMonthPeriod = (a: MonthPeriod, b: MonthPeriod) => a.year === b.year && a.month === b.month;

/** The month `by` months later (negative: earlier) */
export function shiftMonthPeriod(period: MonthPeriod, by: number): MonthPeriod {
    const index = period.year * 12 + period.month - 1 + by;
    return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** Every day of a month (1–12) as "YYYY-MM-DD", in order */
export function monthDates(year: number, month: number): string[] {
    const days = new Date(year, month, 0).getDate();
    const prefix = `${year}-${String(month).padStart(2, '0')}-`;
    return Array.from({ length: days }, (_, i) => `${prefix}${String(i + 1).padStart(2, '0')}`);
}

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
