/**
 * Date utility functions for analytics
 */

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

/**
 * Get today's date in YYYY-MM-DD format
 */
export function getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
}
