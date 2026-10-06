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
