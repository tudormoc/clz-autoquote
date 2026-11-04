/** Texts of the timesheet screens: hours as the people read them, a line in one phrase, the tone of a day's state. */

import type { StatusTone } from '@/components/ui/StatusBadge';
import { formatNumber } from '@/lib/format';
import { KIND_SPECS } from '@/lib/timesheet/kinds';
import type { DayStatus, Entry, EntryKind, HourField } from '@/lib/timesheet/types';
import { APP_COPY, fmt } from '@/locales';

const copy = APP_COPY.timesheet;

/** 8 → "8", 8.5 → "8,5" */
export const formatStepHours = (hours: number) => formatNumber(hours, Number.isInteger(hours) ? 0 : 1);

/** "8,5 h" */
export const hoursText = (hours: number) => fmt(copy.hoursUnit, { hours: formatStepHours(hours) });

export const kindLabel = (kind: EntryKind) => copy.kinds[kind];

export const fieldLabel = (field: HourField) => copy.fields[field];

/** One line in a phrase: "08:00–12:00", "dalle 13:00, ancora dentro", "Ferie 8 h · FESTA" */
export function entryText(entry: Entry): string {
    if (KIND_SPECS[entry.kind].input === 'times') {
        const from = entry.timeFrom ?? '';
        return entry.timeTo ? fmt(copy.day.span, { from, to: entry.timeTo }) : fmt(copy.day.stillIn, { from });
    }
    const parts = [`${kindLabel(entry.kind)} ${hoursText(entry.hours ?? 0)}`];
    if (entry.causale) parts.push(entry.causale);
    return parts.join(' · ');
}

export const STATUS_TONES: Record<DayStatus, StatusTone> = {
    open: 'info',
    short: 'danger',
    pending: 'muted',
    ok: 'success',
    free: 'muted',
    closed: 'neutral',
};
