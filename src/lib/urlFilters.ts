/**
 * Report filters in the address bar (?dateFrom=2025-01-01&client=ROSSI): a refresh, the back button or a link sent to
 * a colleague opens the report with the same filters. Only keys of the report's own filters are read, each turned
 * back into the type of its default value (text, number, yes/no).
 */

type FilterValue = string | number | boolean;

const isFilterValue = (value: unknown): value is FilterValue =>
    typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';

/** The filter object of a report as name → value */
const entries = (filters: unknown): [string, unknown][] => Object.entries(filters as Record<string, unknown>);

/** Filters found in `search` (location.search), or null when it holds none of them */
export function readUrlFilters<F>(defaults: F, search: string): Partial<F> | null {
    const params = new URLSearchParams(search);
    const found: Record<string, FilterValue> = {};
    for (const [key, fallback] of entries(defaults)) {
        const text = params.get(key);
        if (text === null || !isFilterValue(fallback)) continue;
        if (typeof fallback === 'boolean') found[key] = text === 'true';
        else if (typeof fallback === 'number') {
            const number = Number(text);
            if (Number.isFinite(number)) found[key] = number;
        } else found[key] = text;
    }
    return Object.keys(found).length > 0 ? (found as Partial<F>) : null;
}

/** Puts the filters in the address bar (empty texts and "no" left out), keeping the page in history as it is */
export function writeUrlFilters<F>(filters: F | null): void {
    const params = new URLSearchParams();
    if (filters) {
        for (const [key, value] of entries(filters)) {
            if (isFilterValue(value) && value !== '' && value !== false) params.set(key, String(value));
        }
    }
    const query = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
}

/** How many filters differ from their defaults (shown on the folded filter bar) */
export function countChangedFilters<F>(filters: F | null, defaults: F): number {
    if (!filters) return 0;
    const base = new Map(entries(defaults));
    return entries(filters).filter(([key, value]) => isFilterValue(value) && value !== base.get(key)).length;
}
