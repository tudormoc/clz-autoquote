/**
 * Which occurrences a repeating task needs now. Pure: the database layer (src/lib/tasks/db/occurrences.ts) reads
 * what is stored, asks planSeries, and writes the answer; running it again changes nothing.
 *
 * What is kept stored for a repeating task:
 *   - every date up to today + its "visible from" days (so a missed date stays, open, until it is done or skipped);
 *   - plus the next date after that, so the next deadline is always known and can be done early.
 * "after" mode keeps exactly one open occurrence: the next one is made when the last one is closed.
 */

import { addDays, maxDate } from '@/lib/tasks/dates';
import { addInterval, nextPatternDate, patternDates, withinEnd, type RepeatRule } from '@/lib/tasks/repeat';
import { isOpenStatus, type OccurrenceStatus } from '@/lib/tasks/types';

export interface StoredOccurrence {
    id: number;
    originalDate: string | null;
    dueDate: string | null;
    status: OccurrenceStatus;
    /** Day it was done (done ones only) */
    doneDate: string | null;
}

export interface SeriesState {
    rule: RepeatRule;
    /** The task's first date: the rule counts its weeks, months and years from here */
    anchor: string;
    /** No occurrence before this day (the day the task was made, changed or resumed) */
    repeatFrom: string;
    showDays: number;
    /** How many occurrences are stored (for "per N volte") */
    made: number;
    /** The latest original date stored */
    latestDate: string | null;
    /** The latest original date stored that is already visible (within today + "visible from" days) */
    latestShownDate: string | null;
    /** The ones that matter: "calendar" mode the open ones, "after" mode all of them */
    occurrences: StoredOccurrence[];
}

export interface SeriesPlan {
    /** New occurrences: date, and 'replaced' for a missed one the next one already replaces */
    create: { date: string; status: 'open' | 'replaced' }[];
    /** Stored occurrences to mark 'replaced' */
    replace: number[];
}

const NOTHING: SeriesPlan = { create: [], replace: [] };

export function planSeries(state: SeriesState, today: string): SeriesPlan {
    return state.rule.mode === 'calendar' ? planCalendar(state, state.rule, today) : planAfter(state, state.rule);
}

function planCalendar(state: SeriesState, rule: Extract<RepeatRule, { mode: 'calendar' }>, today: string): SeriesPlan {
    const { anchor, repeatFrom, showDays, occurrences, latestDate: latest } = state;
    const horizon = addDays(today, showDays);
    const start = latest ? maxDate(addDays(latest, 1), repeatFrom) : repeatFrom;

    const dates: string[] = [];
    let made = state.made;
    for (const date of patternDates(rule.pattern, anchor, start, horizon)) {
        if (!withinEnd(rule.end, date, made)) break;
        dates.push(date);
        made++;
    }
    // The next date after the horizon, unless one is stored already
    if (!(latest && latest > horizon)) {
        const after = maxDate(dates.at(-1) ?? addDays(start, -1), horizon);
        const next = nextPatternDate(rule.pattern, anchor, after);
        if (next && withinEnd(rule.end, next, made)) dates.push(next);
    }

    if (rule.missed === 'keep') return { create: dates.map((date) => ({ date, status: 'open' })), replace: [] };

    // "Only the latest": a missed date gives way once a later one is visible (its "visible from" day has come)
    const visible = (date: string) => addDays(date, -showDays) <= today;
    const all = [...occurrences.map((o) => o.originalDate), latest, state.latestShownDate, ...dates].filter((date): date is string => date !== null);
    const supersededBefore = all.filter(visible).reduce<string | null>((last, date) => (last === null || date > last ? date : last), null);
    const missed = (original: string, due: string | null) => supersededBefore !== null && original < supersededBefore && (due ?? original) < today;

    return {
        create: dates.map((date) => ({ date, status: missed(date, date) ? 'replaced' : 'open' })),
        replace: occurrences
            .filter((o) => o.status === 'open' && o.originalDate !== null && missed(o.originalDate, o.dueDate))
            .map((o) => o.id),
    };
}

function planAfter(state: SeriesState, rule: Extract<RepeatRule, { mode: 'after' }>): SeriesPlan {
    const { anchor, repeatFrom, occurrences } = state;
    if (occurrences.length === 0) {
        const first = maxDate(anchor, repeatFrom);
        return withinEnd(rule.end, first, 0) ? { create: [{ date: first, status: 'open' }], replace: [] } : NOTHING;
    }
    // The last one made (highest id): done early, the next can fall before an older date
    const last = occurrences.reduce((a, b) => (b.id > a.id ? b : a));
    if (isOpenStatus(last.status)) return NOTHING;

    const base = (last.status === 'done' ? last.doneDate : null) ?? last.dueDate ?? last.originalDate ?? repeatFrom;
    let next = maxDate(addInterval(base, rule.every, rule.unit), repeatFrom);
    // One occurrence per date: an older one already on that day moves the new one to the day after
    const taken = new Set(occurrences.map((o) => o.originalDate));
    while (taken.has(next)) next = addDays(next, 1);
    return withinEnd(rule.end, next, state.made) ? { create: [{ date: next, status: 'open' }], replace: [] } : NOTHING;
}
