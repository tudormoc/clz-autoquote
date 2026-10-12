import type { RecordKind } from '@/components/admin/record-editor/types';
import { isIsoDate } from '@/lib/tasks/dates';

/** Value as it appears in an input: percent 0.1 → "10" (rounded, so 0.1 * 100 does not show 10.000000000000002) */
export function draftOf(kind: RecordKind, value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'boolean') return value ? '1' : '0';
    if (kind === 'percent') return String(Number((Number(value) * 100).toFixed(4)));
    return String(value);
}

/** Typed text → value to store; undefined when it is not valid (empty text, not a number). */
export function parseDraft(kind: RecordKind, draft: string): string | number | null | undefined {
    const text = draft.trim();
    switch (kind) {
        case 'text':
        case 'choice':
            return text === '' ? undefined : text;
        case 'integer': {
            const n = Number.parseInt(text, 10);
            return Number.isNaN(n) ? undefined : n;
        }
        case 'decimal': {
            const n = Number.parseFloat(text);
            return Number.isNaN(n) ? undefined : n;
        }
        case 'optionalInteger': {
            if (text === '') return null;
            const n = Number.parseInt(text, 10);
            return Number.isNaN(n) ? undefined : n || null; // 0 also means "no limit"
        }
        case 'percent': {
            const n = Number.parseFloat(text);
            return Number.isNaN(n) ? undefined : Number((n / 100).toFixed(6));
        }
        case 'date':
            return isIsoDate(text) ? text : undefined;
        case 'flag':
            return text === '1' ? 1 : text === '0' ? 0 : undefined;
    }
}
