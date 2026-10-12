// ============================================================================
// AGENDA EXAMPLES — the expected behaviour of the date rules, as a regression check:
//
//     npm run tasks:examples
//
// Made-up dates around "today" = Friday 9 October 2026. When a rule changes, update the expected values here in
// the same commit.
// ============================================================================

import { agendaGroup, type AgendaGroup } from '@/lib/tasks/agenda';
import { closedDayChecker, easterSunday, type ClosedDay } from '@/lib/tasks/closedDays';
import { addMonths } from '@/lib/tasks/dates';
import { describeRepeat, weekTitle } from '@/lib/tasks/describe';
import { addInterval, nextPatternDate, patternDates, type IntervalUnit, type RepeatPattern, type RepeatRule } from '@/lib/tasks/repeat';
import { planSeries, type SeriesPlan, type SeriesState, type StoredOccurrence } from '@/lib/tasks/series';
import { isoWeekNumber, monthGrid } from '@/lib/tasks/week';

export interface ExampleResult {
    group: string;
    name: string;
    expected: string;
    actual: string;
    pass: boolean;
}

const TODAY = '2026-10-09';

const monthly16: RepeatPattern = { unit: 'months', every: 1, on: { type: 'days', days: [16] } };
const weeklyFriday: RepeatPattern = { unit: 'weeks', every: 1, weekdays: [5] };

const open = (id: number, date: string): StoredOccurrence => ({ id, originalDate: date, dueDate: date, status: 'open', doneDate: null });

const PATTERN_EXAMPLES: { name: string; pattern: RepeatPattern; anchor: string; from: string; to: string; expect: string[] }[] = [
    { name: 'every month on the 16th', pattern: monthly16, anchor: '2026-10-16', from: '2026-10-01', to: '2027-01-31', expect: ['2026-10-16', '2026-11-16', '2026-12-16', '2027-01-16'] },
    {
        name: 'the 31st in short months = their last day',
        pattern: { unit: 'months', every: 1, on: { type: 'days', days: [31] } },
        anchor: '2026-01-31', from: '2026-01-01', to: '2026-05-31',
        expect: ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31'],
    },
    {
        name: 'every 3 months on the 30th',
        pattern: { unit: 'months', every: 3, on: { type: 'days', days: [30] } },
        anchor: '2026-01-30', from: '2026-01-01', to: '2026-12-31',
        expect: ['2026-01-30', '2026-04-30', '2026-07-30', '2026-10-30'],
    },
    {
        name: 'the 1st and the 15th',
        pattern: { unit: 'months', every: 1, on: { type: 'days', days: [15, 1] } },
        anchor: '2026-10-01', from: '2026-10-01', to: '2026-11-30',
        expect: ['2026-10-01', '2026-10-15', '2026-11-01', '2026-11-15'],
    },
    {
        name: 'last day of the month',
        pattern: { unit: 'months', every: 1, on: { type: 'last' } },
        anchor: '2026-02-01', from: '2026-02-01', to: '2026-04-30',
        expect: ['2026-02-28', '2026-03-31', '2026-04-30'],
    },
    {
        name: 'first Monday of the month',
        pattern: { unit: 'months', every: 1, on: { type: 'weekday', nth: 1, weekday: 1 } },
        anchor: '2026-10-01', from: '2026-10-01', to: '2026-12-31',
        expect: ['2026-10-05', '2026-11-02', '2026-12-07'],
    },
    {
        name: 'last Friday of the month',
        pattern: { unit: 'months', every: 1, on: { type: 'weekday', nth: -1, weekday: 5 } },
        anchor: '2026-10-01', from: '2026-10-01', to: '2026-11-30',
        expect: ['2026-10-30', '2026-11-27'],
    },
    { name: 'every Friday', pattern: weeklyFriday, anchor: TODAY, from: TODAY, to: '2026-10-31', expect: ['2026-10-09', '2026-10-16', '2026-10-23', '2026-10-30'] },
    {
        name: 'every 2 weeks, Monday and Friday (not before the first date)',
        pattern: { unit: 'weeks', every: 2, weekdays: [5, 1] },
        anchor: TODAY, from: TODAY, to: '2026-11-08',
        expect: ['2026-10-09', '2026-10-19', '2026-10-23', '2026-11-02', '2026-11-06'],
    },
    {
        name: 'every 10 days',
        pattern: { unit: 'days', every: 10 },
        anchor: TODAY, from: '2026-10-15', to: '2026-11-10',
        expect: ['2026-10-19', '2026-10-29', '2026-11-08'],
    },
    {
        name: 'every year on 16/06 and 16/12',
        pattern: { unit: 'years', every: 1, dates: [{ month: 12, day: 16 }, { month: 6, day: 16 }] },
        anchor: '2026-06-16', from: '2026-07-01', to: '2027-12-31',
        expect: ['2026-12-16', '2027-06-16', '2027-12-16'],
    },
    {
        name: '29 February = 28 February in other years',
        pattern: { unit: 'years', every: 1, dates: [{ month: 2, day: 29 }] },
        anchor: '2024-02-29', from: '2025-01-01', to: '2028-12-31',
        expect: ['2025-02-28', '2026-02-28', '2027-02-28', '2028-02-29'],
    },
    { name: 'first date ten years back', pattern: monthly16, anchor: '2016-01-16', from: '2026-10-01', to: '2026-11-30', expect: ['2026-10-16', '2026-11-16'] },
];

const NEXT_EXAMPLES: { name: string; pattern: RepeatPattern; anchor: string; after: string; expect: string }[] = [
    { name: 'month after the 16th', pattern: monthly16, anchor: '2026-01-16', after: '2026-10-16', expect: '2026-11-16' },
    { name: 'every 5 years', pattern: { unit: 'years', every: 5, dates: [{ month: 3, day: 1 }] }, anchor: '2026-03-01', after: '2026-03-01', expect: '2031-03-01' },
    { name: 'Friday after a Saturday', pattern: weeklyFriday, anchor: TODAY, after: '2026-10-17', expect: '2026-10-23' },
];

const INTERVAL_EXAMPLES: { from: string; every: number; unit: IntervalUnit; expect: string }[] = [
    { from: '2026-01-31', every: 1, unit: 'months', expect: '2026-02-28' },
    { from: TODAY, every: 3, unit: 'months', expect: '2027-01-09' },
    { from: TODAY, every: 2, unit: 'weeks', expect: '2026-10-23' },
    { from: '2028-02-29', every: 1, unit: 'years', expect: '2029-02-28' },
];

const COMPANY_DAYS: ClosedDay[] = [
    { id: 1, closedOn: '2020-06-13', name: 'Santo patrono', everyYear: true },
    { id: 2, closedOn: '2026-08-14', name: 'Chiusura estiva', everyYear: false },
];

const WORKING_DAY_EXAMPLES: { name: string; date: string; expect: string }[] = [
    { name: 'open day stays', date: TODAY, expect: TODAY },
    { name: 'Sunday → Friday', date: '2026-10-11', expect: TODAY },
    { name: 'Ognissanti on a Sunday → Friday 30/10', date: '2026-11-01', expect: '2026-10-30' },
    { name: 'Christmas Friday, Santo Stefano Saturday → Thursday 24/12', date: '2026-12-26', expect: '2026-12-24' },
    { name: 'Pasquetta → Thursday before Easter', date: '2026-04-06', expect: '2026-04-03' },
    { name: 'patron saint every year (Tuesday 13/06/2028) → Monday', date: '2028-06-13', expect: '2028-06-12' },
    { name: 'Ferragosto Saturday, company closed Friday → Thursday', date: '2026-08-15', expect: '2026-08-13' },
];

const GROUP_EXAMPLES: { name: string; dueDate: string | null; suggestedDate?: string; showDays?: number; expect: AgendaGroup }[] = [
    { name: 'yesterday', dueDate: '2026-10-08', expect: 'overdue' },
    { name: 'today', dueDate: TODAY, expect: 'today' },
    { name: 'Sunday, suggested today', dueDate: '2026-10-11', suggestedDate: TODAY, expect: 'today' },
    { name: 'in 5 days, shown 7 before', dueDate: '2026-10-14', expect: 'soon' },
    { name: 'in 11 days, shown 7 before', dueDate: '2026-10-20', expect: 'later' },
    { name: 'in 60 days, shown 60 before', dueDate: '2026-12-08', showDays: 60, expect: 'soon' },
    { name: 'no date', dueDate: null, expect: 'nodate' },
];

/** A series as the database layer hands it over: counted, latest date, and (all stored here) occurrences */
const series = (rule: RepeatRule, occurrences: StoredOccurrence[], extra: Partial<SeriesState> = {}): SeriesState => ({
    rule,
    anchor: '2026-10-16',
    repeatFrom: TODAY,
    showDays: 7,
    made: occurrences.length,
    latestDate: occurrences.map((o) => o.originalDate).filter((d): d is string => d !== null).sort().at(-1) ?? null,
    latestShownDate: null,
    occurrences,
    ...extra,
});
const calendar = (pattern: RepeatPattern, missed: 'keep' | 'latest' = 'keep', end: RepeatRule['end'] = { type: 'never' }): RepeatRule => ({ mode: 'calendar', pattern, missed, end });
const every3Months: RepeatRule = { mode: 'after', every: 3, unit: 'months', end: { type: 'never' } };

const SERIES_EXAMPLES: { name: string; state: SeriesState; today: string; expect: SeriesPlan }[] = [
    {
        name: 'new monthly task: this date and the next one',
        state: series(calendar(monthly16), []),
        today: TODAY,
        expect: { create: [{ date: '2026-10-16', status: 'open' }, { date: '2026-11-16', status: 'open' }], replace: [] },
    },
    {
        name: 'two missed months stay open, the next one is added',
        state: series(calendar(monthly16), [open(1, '2026-10-16'), open(2, '2026-11-16')]),
        today: '2026-11-20',
        expect: { create: [{ date: '2026-12-16', status: 'open' }], replace: [] },
    },
    {
        name: 'nothing to do when the next one is known',
        state: series(calendar(monthly16), [open(1, '2026-10-16'), open(2, '2026-11-16')]),
        today: '2026-10-20',
        expect: { create: [], replace: [] },
    },
    {
        name: 'weekly "only the latest": the missed Friday gives way',
        state: series(calendar(weeklyFriday, 'latest'), [open(1, '2026-10-09'), open(2, '2026-10-16')], { anchor: TODAY, showDays: 3 }),
        today: '2026-10-17',
        expect: { create: [{ date: '2026-10-23', status: 'open' }], replace: [1] },
    },
    {
        name: '"only the latest" never replaces one not yet late',
        state: series(calendar(weeklyFriday, 'latest'), [], { anchor: TODAY, repeatFrom: '2026-10-14', showDays: 10 }),
        today: '2026-10-14',
        expect: { create: [{ date: '2026-10-16', status: 'open' }, { date: '2026-10-23', status: 'open' }, { date: '2026-10-30', status: 'open' }], replace: [] },
    },
    {
        name: 'stops after 2 times',
        state: series(calendar(monthly16, 'keep', { type: 'count', count: 2 }), [open(1, '2026-10-16'), open(2, '2026-11-16')]),
        today: '2026-11-20',
        expect: { create: [], replace: [] },
    },
    {
        name: 'stops at its end date',
        state: series(calendar(monthly16, 'keep', { type: 'until', date: '2026-11-30' }), [open(1, '2026-10-16'), open(2, '2026-11-16')]),
        today: '2026-11-20',
        expect: { create: [], replace: [] },
    },
    {
        name: 'first date long ago: nothing before the day it was made',
        state: series(calendar(monthly16), [], { anchor: '2026-01-16' }),
        today: TODAY,
        expect: { create: [{ date: '2026-10-16', status: 'open' }, { date: '2026-11-16', status: 'open' }], replace: [] },
    },
    {
        name: '"after" mode: the first one',
        state: series(every3Months, [], { anchor: TODAY }),
        today: TODAY,
        expect: { create: [{ date: TODAY, status: 'open' }], replace: [] },
    },
    {
        name: '"after" mode: 3 months after the day it was done',
        state: series(every3Months, [{ id: 1, originalDate: TODAY, dueDate: TODAY, status: 'done', doneDate: '2026-10-20' }], { anchor: TODAY }),
        today: '2026-10-20',
        expect: { create: [{ date: '2027-01-20', status: 'open' }], replace: [] },
    },
    {
        name: '"after" mode: nothing while one is open',
        state: series(every3Months, [open(1, TODAY)], { anchor: TODAY }),
        today: '2026-12-01',
        expect: { create: [], replace: [] },
    },
];

const DESCRIBE_EXAMPLES: { rule: RepeatRule | null; expect: string }[] = [
    { rule: null, expect: 'Una volta' },
    { rule: calendar(monthly16), expect: 'Ogni mese, il 16' },
    { rule: calendar({ unit: 'weeks', every: 2, weekdays: [5, 1] }), expect: 'Ogni 2 settimane, lun e ven' },
    { rule: calendar(weeklyFriday, 'latest'), expect: "Ogni settimana, ven, conta solo l'ultima" },
    { rule: calendar({ unit: 'months', every: 3, on: { type: 'last' } }), expect: "Ogni 3 mesi, l'ultimo giorno" },
    { rule: calendar({ unit: 'months', every: 1, on: { type: 'weekday', nth: 1, weekday: 1 } }), expect: 'Ogni mese, il primo lunedì' },
    { rule: calendar({ unit: 'months', every: 1, on: { type: 'weekday', nth: -1, weekday: 7 } }), expect: "Ogni mese, l'ultima domenica" },
    { rule: calendar({ unit: 'years', every: 1, dates: [{ month: 6, day: 16 }, { month: 12, day: 16 }] }), expect: 'Ogni anno, il 16/06 e 16/12' },
    { rule: every3Months, expect: "3 mesi dopo l'ultima volta" },
    { rule: calendar(monthly16, 'keep', { type: 'until', date: '2026-11-30' }), expect: 'Ogni mese, il 16, fino al 30/11/2026' },
    { rule: calendar({ unit: 'days', every: 1 }, 'keep', { type: 'count', count: 5 }), expect: 'Ogni giorno, per 5 volte' },
];

const WEEK_EXAMPLES: { name: string; expect: unknown; actual: () => unknown }[] = [
    { name: 'ISO week of Friday 9/10/2026', expect: 41, actual: () => isoWeekNumber(TODAY) },
    { name: 'ISO week of 1/1/2027 (still week 53 of 2026)', expect: 53, actual: () => isoWeekNumber('2027-01-01') },
    { name: 'ISO week of 4/1/2027', expect: 1, actual: () => isoWeekNumber('2027-01-04') },
    { name: 'October 2026 grid', expect: { start: '2026-09-28', end: '2026-11-01' }, actual: () => monthGrid('2026-10') },
    { name: 'February 2027 grid', expect: { start: '2027-02-01', end: '2027-02-28' }, actual: () => monthGrid('2027-02') },
    { name: 'week title in one month', expect: '12 – 18 ottobre 2026', actual: () => weekTitle('2026-10-12') },
    { name: 'week title across months', expect: '28 settembre – 4 ottobre 2026', actual: () => weekTitle('2026-09-28') },
    { name: 'week title across years', expect: '28 dicembre 2026 – 3 gennaio 2027', actual: () => weekTitle('2026-12-28') },
];

const result = (group: string, name: string, expected: unknown, actual: unknown): ExampleResult => {
    const e = JSON.stringify(expected);
    const a = JSON.stringify(actual);
    return { group, name, expected: e, actual: a, pass: e === a };
};

export function runTaskExamples(): ExampleResult[] {
    const checker = closedDayChecker(COMPANY_DAYS);
    return [
        ...PATTERN_EXAMPLES.map((ex) => result('dates', ex.name, ex.expect, patternDates(ex.pattern, ex.anchor, ex.from, ex.to))),
        ...NEXT_EXAMPLES.map((ex) => result('next', ex.name, ex.expect, nextPatternDate(ex.pattern, ex.anchor, ex.after))),
        ...INTERVAL_EXAMPLES.map((ex) => result('after', `${ex.from} + ${ex.every} ${ex.unit}`, ex.expect, addInterval(ex.from, ex.every, ex.unit))),
        result('dates', '31/01 + 1 month', '2026-02-28', addMonths('2026-01-31', 1)),
        ...[['2025', '2025-04-20'], ['2026', '2026-04-05'], ['2027', '2027-03-28']].map(([year, expect]) => result('easter', year, expect, easterSunday(Number(year)))),
        ...WORKING_DAY_EXAMPLES.map((ex) => result('closed', ex.name, ex.expect, checker.workingDayOnOrBefore(ex.date))),
        ...GROUP_EXAMPLES.map((ex) =>
            result('agenda', ex.name, ex.expect, agendaGroup({ dueDate: ex.dueDate, suggestedDate: ex.suggestedDate ?? null, showDays: ex.showDays ?? 7 }, TODAY))
        ),
        ...SERIES_EXAMPLES.map((ex) => result('series', ex.name, ex.expect, planSeries(ex.state, ex.today))),
        ...DESCRIBE_EXAMPLES.map((ex) => result('words', ex.expect, ex.expect, describeRepeat(ex.rule))),
        ...WEEK_EXAMPLES.map((ex) => result('week', ex.name, ex.expect, ex.actual())),
    ];
}
