/**
 * Worked examples of the timesheet: what a day adds up to (day.ts), what the editor accepts (input.ts), the steps
 * (time.ts). They document the agreed behaviour and run as a regression check:
 *
 *     npm run timesheet:examples
 *
 * When something changes, update the expected values here in the same commit.
 */

import { APP_COPY } from '@/locales';
import { entryCoverage, remainingToWorkday, summarizeDay } from './day';
import { inputProblem } from './input';
import { causaleDefault } from './kinds';
import { nextWorkSpan, normalDayOf } from './normalDay';
import { hoursOptions, isStepHours, isStepTime, shiftedEnd, timeOptions } from './time';
import type { DayStatus, Entry, EntryInput, EntryKind, HourField, WorkSpan } from './types';

const messages = APP_COPY.timesheet.messages;

/** A Wednesday; the examples name the days around it */
const TODAY = '2026-11-04';
const YESTERDAY = '2026-11-03';
const MONDAY = '2026-11-02';
/** A Thursday before the start of the timesheet (APP_CONFIG.TIMESHEET.START_DAY) */
const OCTOBER = '2026-10-15';
const SATURDAY = '2026-11-07';
const SUNDAY = '2026-11-08';
/** A Friday */
const CHRISTMAS = '2026-12-25';
const WORKING_DAYS = [1, 2, 3, 4, 5];

let nextId = 1;
function line(day: string, kind: EntryKind, rest: Partial<Entry>): Entry {
    return { id: nextId++, operatorCode: '98', day, kind, timeFrom: null, timeTo: null, hours: null, causale: '', note: '', version: '0x0000000000000001', ...rest };
}
const work = (day: string, from: string, to: string | null) => line(day, 'work', { timeFrom: from, timeTo: to });
const hours = (day: string, kind: EntryKind, value: number, causale = '') => line(day, kind, { hours: value, causale });

export interface DayExample {
    note: string;
    day: string;
    entries: Entry[];
    /** 8 unless stated */
    workdayHours?: number;
    /** The company closed day it is, when it is one */
    closedReason?: string;
    expect: { hours?: Partial<Record<HourField, number>>; causaleFerie?: string; status: DayStatus; missing?: number };
}

const DAY_EXAMPLES: readonly DayExample[] = [
    { note: 'a full day in two spans', day: YESTERDAY, entries: [work(YESTERDAY, '08:00', '12:00'), work(YESTERDAY, '13:00', '17:00')], expect: { hours: { ordinarie: 8 }, status: 'ok', missing: 0 } },
    { note: 'half an hour short, yesterday: an alert', day: YESTERDAY, entries: [work(YESTERDAY, '08:00', '12:00'), work(YESTERDAY, '13:00', '16:30')], expect: { hours: { ordinarie: 7.5 }, status: 'short', missing: 0.5 } },
    { note: 'the same today: not an alert yet', day: TODAY, entries: [work(TODAY, '08:00', '12:00'), work(TODAY, '13:00', '16:30')], expect: { hours: { ordinarie: 7.5 }, status: 'pending', missing: 0.5 } },
    { note: 'still in: the open span does not count yet', day: TODAY, entries: [work(TODAY, '08:00', '12:00'), work(TODAY, '13:00', null)], expect: { hours: { ordinarie: 4 }, status: 'open' } },
    { note: 'ferie for the whole day, type FESTA', day: YESTERDAY, entries: [hours(YESTERDAY, 'ferie', 8, 'FESTA')], expect: { hours: { ferie: 8 }, causaleFerie: 'FESTA', status: 'ok' } },
    { note: 'four hours of work and four of permesso', day: YESTERDAY, entries: [work(YESTERDAY, '08:00', '12:00'), hours(YESTERDAY, 'permesso', 4, 'ROL')], expect: { hours: { ordinarie: 4, permesso: 4 }, status: 'ok' } },
    { note: 'nine hours of work: ordinarie 9, no rule caps them', day: YESTERDAY, entries: [work(YESTERDAY, '08:00', '12:00'), work(YESTERDAY, '13:00', '18:00')], expect: { hours: { ordinarie: 9 }, status: 'ok' } },
    { note: 'straordinarie are what the person writes', day: YESTERDAY, entries: [work(YESTERDAY, '08:00', '12:00'), work(YESTERDAY, '13:00', '17:00'), hours(YESTERDAY, 'straordinarie', 2)], expect: { hours: { ordinarie: 8, straordinarie: 2 }, status: 'ok' } },
    { note: 'malattia for the whole day', day: YESTERDAY, entries: [hours(YESTERDAY, 'malattia', 8)], expect: { hours: { malattia: 8 }, status: 'ok' } },
    { note: 'a past working day with nothing: the whole workday missing', day: YESTERDAY, entries: [], expect: { status: 'short', missing: 8 } },
    { note: 'a Saturday with three hours: nothing expected', day: SATURDAY, entries: [work(SATURDAY, '08:00', '11:00')], expect: { hours: { ordinarie: 3 }, status: 'ok', missing: 0 } },
    { note: 'a Sunday with nothing', day: SUNDAY, entries: [], expect: { status: 'free' } },
    { note: 'a company closed day with nothing: ferie by itself, named after it', day: CHRISTMAS, closedReason: 'Natale', entries: [], expect: { hours: { ferie: 8 }, causaleFerie: 'Natale', status: 'closed' } },
    { note: 'a closed day on which someone worked: only what was entered', day: CHRISTMAS, closedReason: 'Natale', entries: [work(CHRISTMAS, '09:00', '11:00')], expect: { hours: { ordinarie: 2, ferie: 0 }, status: 'ok' } },
    { note: 'a closed day on a Saturday: nothing', day: SATURDAY, closedReason: 'Chiusura', entries: [], expect: { hours: { ferie: 0 }, status: 'free' } },
    { note: 'a six-hour person: six hours is a full day', day: YESTERDAY, workdayHours: 6, entries: [work(YESTERDAY, '08:00', '14:00')], expect: { hours: { ordinarie: 6 }, status: 'ok' } },
    { note: 'a six-hour person one hour short', day: YESTERDAY, workdayHours: 6, entries: [work(YESTERDAY, '08:00', '12:00'), hours(YESTERDAY, 'permesso', 1)], expect: { status: 'short', missing: 1 } },
    { note: 'a six-hour person on a closed day: six hours of ferie', day: CHRISTMAS, workdayHours: 6, closedReason: 'Natale', entries: [], expect: { hours: { ferie: 6 }, status: 'closed' } },
    { note: 'a working day before the start of the timesheet: quiet, nothing expected', day: OCTOBER, entries: [], expect: { status: 'free', missing: 0 } },
];

export interface DayExampleResult {
    example: DayExample;
    actual: { hours: Partial<Record<HourField, number>>; causaleFerie: string; status: DayStatus; missing: number };
    pass: boolean;
}

export function runDayExamples(): DayExampleResult[] {
    return DAY_EXAMPLES.map((example) => {
        const summary = summarizeDay(example.day, example.entries, {
            workdayHours: example.workdayHours ?? 8,
            workingDays: WORKING_DAYS,
            closedReason: example.closedReason ?? null,
            today: TODAY,
            startDay: '2026-11-01',
        });
        const { expect } = example;
        const hoursPass = Object.entries(expect.hours ?? {}).every(([field, value]) => summary.hours[field as HourField] === value);
        const pass =
            hoursPass &&
            summary.status === expect.status &&
            (expect.missing === undefined || summary.missing === expect.missing) &&
            (expect.causaleFerie === undefined || summary.causaleFerie === expect.causaleFerie);
        const actual = {
            hours: Object.fromEntries(Object.entries(summary.hours).filter(([, value]) => value !== 0)) as Partial<Record<HourField, number>>,
            causaleFerie: summary.causaleFerie,
            status: summary.status,
            missing: summary.missing,
        };
        return { example, actual, pass };
    });
}

export interface InputExample {
    note: string;
    input: EntryInput;
    /** The message the editor shows, null when the input is fine */
    expect: string | null;
}

const entry = (rest: Partial<EntryInput>): EntryInput => ({ kind: 'work', timeFrom: null, timeTo: null, hours: null, causale: '', note: '', ...rest });

const INPUT_EXAMPLES: readonly InputExample[] = [
    { note: 'a work span', input: entry({ timeFrom: '08:00', timeTo: '12:00' }), expect: null },
    { note: 'work without an exit: refused, every line is closed (owner, 2026-11-05)', input: entry({ timeFrom: '08:00' }), expect: messages.timeToRequired },
    { note: 'work without an entry time', input: entry({}), expect: messages.timeFromRequired },
    { note: 'an exit before the entry', input: entry({ timeFrom: '12:00', timeTo: '08:00' }), expect: messages.timeOrder },
    { note: 'a quarter hour', input: entry({ timeFrom: '08:15', timeTo: '12:00' }), expect: messages.step },
    { note: 'ferie without hours', input: entry({ kind: 'ferie' }), expect: messages.hoursRequired },
    { note: 'hours off the step', input: entry({ kind: 'ferie', hours: 8.25 }), expect: messages.step },
    { note: 'a permesso with its type and a note', input: entry({ kind: 'permesso', hours: 2, causale: 'ROL', note: 'visita medica' }), expect: null },
];

export function runInputExamples(): { example: InputExample; actual: string | null; pass: boolean }[] {
    return INPUT_EXAMPLES.map((example) => {
        const actual = inputProblem(example.input);
        return { example, actual, pass: actual === example.expect };
    });
}

export interface StepExample {
    note: string;
    actual: string | boolean;
    expect: string | boolean;
}

export function runStepExamples(): (StepExample & { pass: boolean })[] {
    const examples: StepExample[] = [
        { note: '08:30 is on the step', actual: isStepTime('08:30'), expect: true },
        { note: '08:15 is not', actual: isStepTime('08:15'), expect: false },
        { note: '8.5 hours are on the step', actual: isStepHours(8.5), expect: true },
        { note: '8.25 are not', actual: isStepHours(8.25), expect: false },
        { note: 'the first pick of Dalle / Alle (company open hours)', actual: timeOptions('07:00', '19:00')[0], expect: '07:00' },
        { note: 'the last pick', actual: timeOptions('07:00', '19:00')[timeOptions('07:00', '19:00').length - 1], expect: '19:00' },
        { note: 'an 8-hour person picks hours from 0,5 to 8', actual: `${hoursOptions(8)[0]}-${hoursOptions(8)[hoursOptions(8).length - 1]}`, expect: '0.5-8' },
        { note: 'a 6-hour person only up to 6', actual: String(hoursOptions(6)[hoursOptions(6).length - 1]), expect: '6' },
        { note: 'Alle follows a new Dalle by half the workday', actual: shiftedEnd('08:30', null, null, 8, '19:00') ?? 'none', expect: '12:30' },
        { note: 'moving Dalle keeps the span already proposed', actual: shiftedEnd('09:00', '08:30', '12:30', 8, '19:00') ?? 'none', expect: '13:00' },
        { note: 'Alle never passes the last pick', actual: shiftedEnd('17:00', null, null, 8, '19:00') ?? 'none', expect: '19:00' },
        { note: 'ferie starts with the quick text named FERIE', actual: causaleDefault('ferie', { feriePresets: ['FESTA', 'FERIE'], permessoPresets: [] }), expect: 'FERIE' },
        { note: 'or with the first quick text when none is named so', actual: causaleDefault('ferie', { feriePresets: ['FESTA', 'CHIUSURA'], permessoPresets: [] }), expect: 'FESTA' },
        { note: 'a closed work line covers its span (what a new permesso proposes builds on this)', actual: String(entryCoverage(work(MONDAY, '08:00', '12:00'))), expect: '4' },
        { note: 'an open line covers nothing yet', actual: String(entryCoverage(work(MONDAY, '08:00', null))), expect: '0' },
        { note: 'straordinarie never cover the day', actual: String(entryCoverage(hours(MONDAY, 'straordinarie', 2))), expect: '0' },
        { note: 'a Saturday half filled still misses 4 h to the workday (proposals count any day the same)', actual: String(remainingToWorkday([work(SATURDAY, '08:30', '12:30')], 8)), expect: '4' },
        { note: 'an empty day misses the whole workday', actual: String(remainingToWorkday([], 8)), expect: '8' },
        { note: 'the line being changed is counted out of what is missing', actual: (() => { const edited = work(MONDAY, '08:00', '12:00'); return String(remainingToWorkday([edited, hours(MONDAY, 'permesso', 4)], 8, edited)); })(), expect: '4' },
    ];
    return examples.map((example) => ({ ...example, pass: example.actual === example.expect }));
}

export interface NormalDayExample {
    note: string;
    actual: string;
    expect: string;
}

/** Spans as one short text for the comparison */
const spansKey = (spans: readonly WorkSpan[]) => spans.map((span) => `${span.from}-${span.to}`).join(' ') || 'none';

/** The giornata normale: built from nothing, learned from the last plain workday, and what the fill touches */
export function runNormalDayExamples(): (NormalDayExample & { pass: boolean })[] {
    const normalOf = (entries: Entry[], workday = 8) => spansKey(normalDayOf(entries, workday).spans);
    const nextOf = (entries: Entry[], missing: number) => {
        const span = nextWorkSpan(entries, missing, '19:00');
        return span ? `${span.from}-${span.to ?? 'aperta'}` : 'none';
    };
    const examples: NormalDayExample[] = [
        { note: 'nothing entered yet: no suggestion (never invented)', actual: normalOf([]), expect: 'none' },
        { note: 'only a short day so far: still no suggestion', actual: normalOf([work(MONDAY, '09:00', '12:00')]), expect: 'none' },
        {
            note: 'learned from the last day that reaches the workday (the 7 h day is skipped)',
            actual: normalOf([work(MONDAY, '08:00', '12:30'), work(MONDAY, '13:30', '17:00'), work(YESTERDAY, '09:00', '13:00'), work(YESTERDAY, '14:00', '17:00')]),
            expect: '08:00-12:30 13:30-17:00',
        },
        {
            note: 'a longer day teaches too: at least the workday counts',
            actual: normalOf([work(MONDAY, '08:00', '12:00'), work(MONDAY, '13:00', '18:00')]),
            expect: '08:00-12:00 13:00-18:00',
        },
        {
            note: 'a day with an open line is skipped',
            actual: normalOf([work(MONDAY, '08:00', '12:00'), work(MONDAY, '13:00', '17:00'), work(YESTERDAY, '08:00', null)]),
            expect: '08:00-12:00 13:00-17:00',
        },
        {
            note: 'extra hour lines on the learned day do not change its spans',
            actual: normalOf([work(MONDAY, '08:00', '12:00'), hours(MONDAY, 'straordinarie', 2), work(MONDAY, '13:00', '17:00')]),
            expect: '08:00-12:00 13:00-17:00',
        },
        {
            note: 'a day shortened by permesso is skipped: the suggestion stays the usual day',
            actual: normalOf([work(MONDAY, '08:00', '12:30'), work(MONDAY, '13:30', '17:00'), work(YESTERDAY, '08:00', '12:00'), hours(YESTERDAY, 'permesso', 4)]),
            expect: '08:00-12:30 13:30-17:00',
        },
        {
            note: 'a four-hour person learns their own four-hour day',
            actual: normalOf([work(MONDAY, '08:00', '10:00'), work(MONDAY, '11:00', '13:00')], 4),
            expect: '08:00-10:00 11:00-13:00',
        },
        {
            note: 'the next work line: a break after the last exit, ending when the day is covered',
            actual: nextOf([work(MONDAY, '08:30', '12:30')], 4),
            expect: '13:30-17:30',
        },
        {
            note: 'nothing missing: only the start is proposed',
            actual: nextOf([work(MONDAY, '08:00', '12:00'), hours(MONDAY, 'permesso', 4)], 0),
            expect: '13:00-aperta',
        },
        {
            note: 'never past the last pick of the day',
            actual: nextOf([work(MONDAY, '08:30', '13:30')], 8),
            expect: '14:30-19:00',
        },
        {
            note: 'too late for another line: nothing proposed',
            actual: nextOf([work(MONDAY, '08:00', '18:30')], 0),
            expect: 'none',
        },
    ];
    return examples.map((example) => ({ ...example, pass: example.actual === example.expect }));
}
