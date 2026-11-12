/**
 * Date helpers: the one place for date arithmetic (owner, 2026-11-12: the reports, the Agenda and the presence rules
 * each had their own day of the week, days of a month and month shift). Dates travel through the app as local
 * "YYYY-MM-DD" strings (SQL DATE, no time zone); for display use formatDate() from src/lib/format.ts.
 *
 * Arithmetic on those strings is done in UTC inside, so a daylight-saving change never shifts a day; ISO strings
 * compare correctly with < and >. The few helpers that take or give a `Date` work on the local calendar.
 */

// ── From and to a Date (local calendar) ─────────────────────────────────────────────────────────────────────────────

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

// ── Calendar arithmetic on "YYYY-MM-DD" strings ─────────────────────────────────────────────────────────────────────

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

/** How many days the month (1–12) has */
export function daysInMonth(year: number, month: number): number {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export const addDays = (iso: string, days: number) => fromMs(toMs(iso) + days * DAY_MS);

/** Whole days from a to b (b later → positive) */
export const daysBetween = (a: string, b: string) => Math.round((toMs(b) - toMs(a)) / DAY_MS);

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

/**
 * Every calendar date from `from` to `to` inclusive; none when `to` is before `from`, and none when one of them is
 * not a real date (an empty filter, "2026-02-30"): never a made-up day
 */
export function eachDateInRange(from: string, to: string): string[] {
    if (!isIsoDate(from) || !isIsoDate(to)) return [];
    const days = daysBetween(from, to);
    return days < 0 ? [] : Array.from({ length: days + 1 }, (_, i) => addDays(from, i));
}

// ── Months ──────────────────────────────────────────────────────────────────────────────────────────────────────────

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

/** Same day N months later; past the month's end → its last day (31/01 + 1 month = 28/02) */
export function addMonths(iso: string, months: number): string {
    const { year, month } = shiftMonthPeriod({ year: yearOf(iso), month: monthOf(iso) }, months);
    return makeDate(year, month, dayOf(iso));
}

export interface DateRange {
    dateFrom: string;
    dateTo: string;
}

/** First and last day of a month (1–12) as "YYYY-MM-DD" */
export function monthRange(year: number, month: number): DateRange {
    return { dateFrom: makeDate(year, month, 1), dateTo: makeDate(year, month, daysInMonth(year, month)) };
}

/** Every day of a month (1–12) as "YYYY-MM-DD", in order */
export function monthDates(year: number, month: number): string[] {
    const { dateFrom, dateTo } = monthRange(year, month);
    return eachDateInRange(dateFrom, dateTo);
}

// ── Weeks ───────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Monday of ISO week `week` (1 to 53) of `year`, as a local Date: week 1 is the week with 4 January */
export function isoWeekStart(year: number, week: number): Date {
    const monday = addDays(weekStart(makeDate(year, 1, 4)), (week - 1) * 7);
    return new Date(yearOf(monday), monthOf(monday) - 1, dayOf(monday));
}

// ── The periods of the date filters ─────────────────────────────────────────────────────────────────────────────────

/** The ready-made periods of a date filter ("Periodo" in DateRangeFields), in menu order */
export const DATE_PERIODS = ['lastWeek', 'lastMonth', 'lastYear'] as const;
export type DatePeriod = (typeof DATE_PERIODS)[number];

/** The dates of a period as of `today` (local calendar): whole weeks, months and years already over */
export function periodRange(period: DatePeriod, today: Date = new Date()): DateRange {
    switch (period) {
        case 'lastWeek': {
            // Monday to Sunday of the week before this one (the Monday may fall in the month before)
            const monday = addDays(weekStart(toIsoDate(today)), -7);
            return { dateFrom: monday, dateTo: addDays(monday, 6) };
        }
        case 'lastMonth': {
            const { year, month } = shiftMonthPeriod(thisMonthPeriod(today), -1);
            return monthRange(year, month);
        }
        case 'lastYear':
            return { dateFrom: makeDate(today.getFullYear() - 1, 1, 1), dateTo: makeDate(today.getFullYear() - 1, 12, 31) };
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
