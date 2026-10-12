/**
 * Dates a repeating task will have, before they are stored: the "next dates" under a rule (form, task page) and the
 * planned entries of the calendar. Pure. "after" mode assumes each one is done on its due date.
 */

import { addDays, maxDate } from '@/lib/tasks/dates';
import { addInterval, nextPatternDate, patternDates, withinEnd, type RepeatRule } from '@/lib/tasks/repeat';

/** The next `count` dates of the rule from `from` on (`made` = how many the task already has, for "per N volte") */
export function upcomingDates(rule: RepeatRule, anchor: string, from: string, count: number, made = 0): string[] {
    const dates: string[] = [];
    if (rule.mode === 'calendar') {
        let after = addDays(maxDate(from, anchor), -1);
        while (dates.length < count) {
            const next = nextPatternDate(rule.pattern, anchor, after);
            if (!next || !withinEnd(rule.end, next, made + dates.length)) break;
            dates.push(next);
            after = next;
        }
        return dates;
    }
    let next = maxDate(anchor, from);
    while (dates.length < count && withinEnd(rule.end, next, made + dates.length)) {
        dates.push(next);
        next = addInterval(next, rule.every, rule.unit);
    }
    return dates;
}

/** What is stored of a series, as far as the calendar needs it */
export interface StoredSeries {
    anchor: string;
    repeatFrom: string;
    made: number;
    /** Latest original date stored */
    latestDate: string | null;
    /** Due date of the open occurrence ("after" mode) */
    openDue: string | null;
}

/** Planned dates between start and end (both included) that are not stored yet */
export function plannedDates(rule: RepeatRule, series: StoredSeries, start: string, end: string): string[] {
    if (rule.mode === 'calendar') {
        const from = [start, series.repeatFrom, series.latestDate ? addDays(series.latestDate, 1) : start].reduce(maxDate);
        const dates: string[] = [];
        for (const date of patternDates(rule.pattern, series.anchor, from, end)) {
            if (!withinEnd(rule.end, date, series.made + dates.length)) break;
            dates.push(date);
        }
        return dates;
    }
    const base = series.openDue ?? series.latestDate;
    if (!base) return [];
    const dates: string[] = [];
    let made = series.made;
    for (let next = addInterval(base, rule.every, rule.unit); next <= end && withinEnd(rule.end, next, made); next = addInterval(next, rule.every, rule.unit)) {
        if (next >= start) dates.push(next);
        made++;
    }
    return dates;
}
