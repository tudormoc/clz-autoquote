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

/**
 * Get the start date of last year (January 1st)
 * Example: If current year is 2026, returns '2025-01-01'
 */
export function getLastYearStart(): string {
    const now = new Date();
    const lastYear = now.getFullYear() - 1;
    return `${lastYear}-01-01`;
}

/**
 * Get the end date of last year (December 31st)
 * Example: If current year is 2026, returns '2025-12-31'
 */
export function getLastYearEnd(): string {
    const now = new Date();
    const lastYear = now.getFullYear() - 1;
    return `${lastYear}-12-31`;
}

/** Today's local date in YYYY-MM-DD format */
export function getTodayDate(): string {
    return toIsoDate(new Date());
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
