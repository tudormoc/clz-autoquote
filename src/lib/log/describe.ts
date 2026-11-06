/**
 * A log entry's full record (the JSON in app_log.details, tsk_log.details, timesheet_log.details) as lines a person
 * can read: the rows a write changed ({ rows }), the values before and after ({ before, after }), else the JSON itself. Pure.
 */
import { APP_COPY } from '@/locales';

const copy = APP_COPY.log;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown) => {
    if (value === null || value === undefined || value === '') return copy.empty;
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
};

/** One changed row of a write over several tables (src/lib/orders/snapshot.ts → RowChange) */
function rowLines(row: unknown): string[] {
    if (!isRecord(row)) return [text(row)];
    const name = `${text(row.table)} ${text(row.key)}`;
    if (row.change === 'added') return [`${name}: ${copy.rowAdded}`];
    if (row.change === 'removed') return [`${name}: ${copy.rowRemoved}`];
    const columns = isRecord(row.columns) ? Object.entries(row.columns) : [];
    return [name, ...columns.map(([column, pair]) => `    ${column}: ${Array.isArray(pair) ? `${text(pair[0])} → ${text(pair[1])}` : text(pair)}`)];
}

/** The values that differ between the record before and after (all of one side when the other is missing) */
function beforeAfterLines(before: unknown, after: unknown): string[] {
    const from = isRecord(before) ? before : {};
    const to = isRecord(after) ? after : {};
    return [...new Set([...Object.keys(from), ...Object.keys(to)])]
        .filter((key) => text(from[key]) !== text(to[key]))
        .map((key) => `${key}: ${text(from[key])} → ${text(to[key])}`);
}

export function describeDetails(json: string | null): string[] {
    if (!json) return [];
    let value: unknown;
    try {
        value = JSON.parse(json);
    } catch {
        return [json];
    }
    if (isRecord(value) && Array.isArray(value.rows)) return value.rows.flatMap(rowLines);
    if (isRecord(value) && ('before' in value || 'after' in value)) return beforeAfterLines(value.before, value.after);
    return JSON.stringify(value, null, 2).split('\n');
}
