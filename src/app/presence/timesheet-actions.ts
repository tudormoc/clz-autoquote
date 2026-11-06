'use server'

/**
 * Timesheet: Le mie ore (a person's own month) and Ore Ufficio (everyone's month). Reading needs "vede" on the page.
 * Writing a line needs "modifica": on Le mie ore for one's own lines (the person behind the login, through the
 * operator link of Scheda persona), on Ore Ufficio for anyone's. Every write is checked here against whose line it
 * is, whatever the browser sent. The tables: src/lib/timesheet/db; how it all works: docs/TIMESHEET.md.
 */

import { z } from 'zod';
import { APP_CONFIG } from '@/config/constants';
import { LINKS } from '@/config/navigation';
import { NotFound, attemptWrite, refused, type Result, type Saved } from '@/lib/appTables';
import { authorize } from '@/lib/auth/access';
import { findAccountById } from '@/lib/auth/accounts';
import { canOpen, type UserAccess } from '@/lib/auth/permissions';
import { getTodayDate } from '@/lib/dateUtils';
import { formatDate } from '@/lib/format';
import type { PresenceRulesConfig } from '@/lib/presence';
import { closedDayChecker } from '@/lib/tasks/closedDays';
import { addDays, isIsoDate } from '@/lib/tasks/dates';
import { listClosedDays } from '@/lib/tasks/db/settings';
import { summarizeDay } from '@/lib/timesheet/day';
import { deleteDayEntries, deleteEntry, getEntry, insertDayEntries, insertEntry, listEntries, replaceDayEntries, updateEntry } from '@/lib/timesheet/db/entries';
import { loadMonth, type MonthSources } from '@/lib/timesheet/db/month';
import { findTimesheetPerson, listTimesheetPeople } from '@/lib/timesheet/db/people';
import { cleanEntryInput, inputProblem } from '@/lib/timesheet/input';
import { KIND_SPECS } from '@/lib/timesheet/kinds';
import { entriesByPerson } from '@/lib/timesheet/month';
import { normalDayInputs, normalDayOf } from '@/lib/timesheet/normalDay';
import type { DaySummary, EntryInput, NormalDay, TimesheetBounds, TimesheetPerson } from '@/lib/timesheet/types';
import { APP_COPY, fmt } from '@/locales';
import { loadPresenceRules } from './presence-db';

const MY_PAGE = LINKS.presence.myHours;
const OFFICE_PAGE = LINKS.presence.officeHours;
const messages = APP_COPY.timesheet.messages;

const attempt = <T extends object>(what: string, work: () => Promise<T>) =>
    attemptWrite(`Timesheet: ${what}`, { stale: messages.stale, notFound: messages.notFound }, work);

const beforeStart = (startDay: string) => fmt(messages.beforeStart, { date: formatDate(startDay) });

/** The timesheet settings of Regole Presenze the screens need */
const boundsOf = (rules: PresenceRulesConfig): TimesheetBounds => ({
    startDay: rules.timesheetStart,
    firstTime: rules.timesheetFirstTime,
    lastTime: rules.timesheetLastTime,
});

const IdSchema = z.number().int().positive();
const VersionSchema = z.string().regex(/^0x[0-9A-Fa-f]{16}$/);
const CodeSchema = z.string().trim().min(1).max(20);
const PeriodSchema = z.object({ year: z.number().int().min(2000).max(2100), month: z.number().int().min(1).max(12) });

/** The quick texts the day editor offers for the causali (Regole Presenze) */
export interface CausalePresets {
    feriePresets: string[];
    permessoPresets: string[];
}

/** What every month answer carries besides its days */
export interface MonthData {
    year: number;
    month: number;
    today: string;
    presets: CausalePresets;
    /** The timesheet settings of Regole Presenze: its first day, the picks of Dalle / Alle */
    bounds: TimesheetBounds;
}

/** One person's day in Ore Ufficio */
export interface OfficeDayRow {
    person: TimesheetPerson;
    summary: DaySummary;
}

/** The giornata normale of each of these people, learned from their last days in one read (src/lib/timesheet/normalDay.ts) */
async function normalDaysFor(people: readonly TimesheetPerson[], today: string): Promise<Record<string, NormalDay>> {
    const from = addDays(today, -APP_CONFIG.TIMESHEET.NORMAL_DAY_LOOKBACK_DAYS);
    const byPerson = entriesByPerson(await listEntries(people.map((person) => person.operatorCode), from, today));
    return Object.fromEntries(people.map((person) => [person.operatorCode, normalDayOf(byPerson.get(person.operatorCode) ?? [], person.workdayHours)]));
}

async function monthSources(): Promise<MonthSources> {
    const [rules, closedDays] = await Promise.all([loadPresenceRules(), listClosedDays()]);
    return { rules, closedDays, today: getTodayDate() };
}

const monthData = (period: { year: number; month: number }, sources: MonthSources): MonthData => ({
    ...period,
    today: sources.today,
    presets: { feriePresets: sources.rules.feriePresets, permessoPresets: sources.rules.permessoPresets },
    bounds: boundsOf(sources.rules),
});

/** The person behind the login: the operator their account is linked to, when of a timesheet category */
async function ownPerson(access: UserAccess, rules: PresenceRulesConfig): Promise<TimesheetPerson | null> {
    if (access.id === null) return null;
    const account = await findAccountById(access.id);
    return account?.operatorCode ? findTimesheetPerson(account.operatorCode, rules) : null;
}

/** Le mie ore: the logged-in person's month, with their giornata normale */
export async function getMyMonthAction(year: number, month: number): Promise<Result<MonthData & { person: TimesheetPerson; days: DaySummary[]; normal: NormalDay }>> {
    const access = await authorize('view', MY_PAGE);
    return attempt('my month', async () => {
        const period = PeriodSchema.parse({ year, month });
        const sources = await monthSources();
        const person = await ownPerson(access, sources.rules);
        if (!person) throw new Error(fmt(messages.notLinked, { name: APP_CONFIG.OWNER_NAME }));
        const days = (await loadMonth([person], period.year, period.month, sources)).get(person.operatorCode) ?? [];
        const normal = (await normalDaysFor([person], sources.today))[person.operatorCode];
        return { ...monthData(period, sources), person, days, normal };
    });
}

/** Ore Ufficio: the people of the timesheet, for the filter */
export async function getTimesheetPeopleAction(): Promise<Result<{ people: TimesheetPerson[] }>> {
    await authorize('view', OFFICE_PAGE);
    return attempt('people', async () => ({ people: await listTimesheetPeople(await loadPresenceRules()) }));
}

/** Ore Ufficio: everyone's month (or one person's), one row per person and day */
export async function getOfficeMonthAction(
    year: number,
    month: number,
    operatorCode?: string | null
): Promise<Result<MonthData & { rows: OfficeDayRow[]; normals: Record<string, NormalDay> }>> {
    await authorize('view', OFFICE_PAGE);
    return attempt('office month', async () => {
        const period = PeriodSchema.parse({ year, month });
        const sources = await monthSources();
        const everyone = await listTimesheetPeople(sources.rules);
        const people = operatorCode ? everyone.filter((person) => person.operatorCode === operatorCode) : everyone;
        const months = await loadMonth(people, period.year, period.month, sources);
        const rows = people.flatMap((person) => (months.get(person.operatorCode) ?? []).map((summary): OfficeDayRow => ({ person, summary })));
        return { ...monthData(period, sources), rows, normals: await normalDaysFor(people, sources.today) };
    });
}

/** Whose lines this person may write: their own with "modifica" on Le mie ore, anyone's with "modifica" on Ore Ufficio */
async function writablePerson(access: UserAccess, operatorCode: string, rules: PresenceRulesConfig): Promise<TimesheetPerson> {
    const own = await ownPerson(access, rules);
    if (own && own.operatorCode === operatorCode && canOpen(access, MY_PAGE, 'edit')) return own;
    if (canOpen(access, OFFICE_PAGE, 'edit')) {
        const person = await findTimesheetPerson(operatorCode, rules);
        if (person) return person;
        throw new Error(messages.notPerson);
    }
    throw new Error(APP_COPY.auth.notAllowed);
}

/** A line to add (id null) or change (id and version) on a person's day */
export interface SaveEntryRequest {
    operatorCode: string;
    /** YYYY-MM-DD */
    day: string;
    id: number | null;
    version: string | null;
    input: EntryInput;
}

export async function saveEntryAction(request: SaveEntryRequest): Promise<Result<{ id: number }>> {
    const access = await authorize('edit', MY_PAGE, OFFICE_PAGE);
    const input = cleanEntryInput(request.input);
    const problem = inputProblem(input);
    if (problem) return refused(problem);
    if (!isIsoDate(request.day)) return refused();
    return attempt('save line', async () => {
        const rules = await loadPresenceRules();
        if (request.day < rules.timesheetStart) throw new Error(beforeStart(rules.timesheetStart));
        const person = await writablePerson(access, CodeSchema.parse(request.operatorCode), rules);
        // Ferie and malattia are always the person's whole workday and replace whatever the day held (owner,
        // 2026-11-05); every replaced line stays in the log
        if (KIND_SPECS[input.kind].wholeDay) {
            return { id: await replaceDayEntries(access, person.operatorCode, request.day, { ...input, hours: person.workdayHours }) };
        }
        // A day held by a whole-day line takes nothing beside it
        const others = (await listEntries([person.operatorCode], request.day, request.day)).filter((other) => other.id !== request.id);
        const wholeKind = others.find((other) => KIND_SPECS[other.kind].wholeDay)?.kind;
        if (wholeKind) throw new Error(fmt(messages.wholeDayOnly, { kind: APP_COPY.timesheet.kinds[wholeKind] }));
        if (request.id === null) return { id: await insertEntry(access, person.operatorCode, request.day, input) };

        const id = IdSchema.parse(request.id);
        const entry = await getEntry(id);
        if (!entry) throw new NotFound();
        if (entry.operatorCode !== person.operatorCode) throw new Error(APP_COPY.auth.notAllowed);
        if (entry.day !== request.day) throw new Error(messages.wrongDay);
        await updateEntry(access, id, VersionSchema.parse(request.version), input);
        return { id };
    });
}

/** Writes the person's giornata normale into this one day, only while it is still an empty working day — the days ahead included (owner, 2026-11-06) */
export async function fillNormalDayAction(operatorCode: string, day: string): Promise<Result<{ written: number }>> {
    const access = await authorize('edit', MY_PAGE, OFFICE_PAGE);
    if (!isIsoDate(day)) return refused();
    return attempt('fill day', async () => {
        const sources = await monthSources();
        if (day < sources.rules.timesheetStart) throw new Error(beforeStart(sources.rules.timesheetStart));
        const person = await writablePerson(access, CodeSchema.parse(operatorCode), sources.rules);
        const inputs = normalDayInputs((await normalDaysFor([person], sources.today))[person.operatorCode]);
        const { companyDay } = closedDayChecker(sources.closedDays);
        const summary = summarizeDay(day, await listEntries([person.operatorCode], day, day), {
            workdayHours: person.workdayHours,
            workingDays: sources.rules.workingDays,
            closedReason: companyDay(day),
            today: sources.today,
            startDay: sources.rules.timesheetStart,
        });
        if (summary.entries.length > 0 || summary.expected === 0) return { written: 0 };
        await insertDayEntries(access, person.operatorCode, day, inputs);
        return { written: inputs.length };
    });
}

/** "Svuota giorno": deletes every line of a person's day, each kept in the log, one transaction */
export async function clearDayAction(operatorCode: string, day: string): Promise<Saved> {
    const access = await authorize('edit', MY_PAGE, OFFICE_PAGE);
    if (!isIsoDate(day)) return refused();
    return attempt('clear day', async () => {
        const rules = await loadPresenceRules();
        if (day < rules.timesheetStart) throw new Error(beforeStart(rules.timesheetStart));
        const person = await writablePerson(access, CodeSchema.parse(operatorCode), rules);
        await deleteDayEntries(access, person.operatorCode, day);
        return {};
    });
}

export async function deleteEntryAction(id: number, version: string): Promise<Saved> {
    const access = await authorize('edit', MY_PAGE, OFFICE_PAGE);
    return attempt('delete line', async () => {
        const rules = await loadPresenceRules();
        const entry = await getEntry(IdSchema.parse(id));
        if (!entry) throw new NotFound();
        if (entry.day < rules.timesheetStart) throw new Error(beforeStart(rules.timesheetStart));
        await writablePerson(access, entry.operatorCode, rules);
        await deleteEntry(access, entry.id, VersionSchema.parse(version));
        return {};
    });
}
