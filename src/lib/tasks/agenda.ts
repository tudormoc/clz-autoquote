/**
 * Groups of the "Da fare" list: what is overdue, what is for today, what is coming (within its "visible from"
 * days), what is further away, what has no date. Pure, shared by the server and the screens.
 */

import { addDays, daysBetween } from '@/lib/tasks/dates';

export const AGENDA_GROUPS = ['overdue', 'today', 'soon', 'later', 'nodate'] as const;
export type AgendaGroup = (typeof AGENDA_GROUPS)[number];

interface Dated {
    dueDate: string | null;
    /** The working day before, when the due date is a closed day */
    suggestedDate: string | null;
    showDays: number;
}

/**
 * - overdue: the due date has passed;
 * - today: due today, or its suggested day (the working day before a closed day) has come;
 * - soon: within its "visible from" days;
 * - later: further away;
 * - nodate: no date yet.
 */
export function agendaGroup(item: Dated, today: string): AgendaGroup {
    if (!item.dueDate) return 'nodate';
    if (item.dueDate < today) return 'overdue';
    const target = item.suggestedDate ?? item.dueDate;
    if (target <= today) return 'today';
    return addDays(target, -item.showDays) <= today ? 'soon' : 'later';
}

/** Days from today to the due date (negative: days late) */
export const daysLeft = (dueDate: string, today: string) => daysBetween(today, dueDate);
