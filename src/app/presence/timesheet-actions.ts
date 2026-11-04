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
import type { PresenceRulesConfig } from '@/lib/presence';
import { isIsoDate } from '@/lib/tasks/dates';
import { listClosedDays } from '@/lib/tasks/db/settings';
import { deleteEntry, getEntry, insertEntry, updateEntry } from '@/lib/timesheet/db/entries';
import { loadMonth, type MonthSources } from '@/lib/timesheet/db/month';
import { findTimesheetPerson, listTimesheetPeople } from '@/lib/timesheet/db/people';
import { cleanEntryInput, inputProblem } from '@/lib/timesheet/input';
import type { DaySummary, EntryInput, TimesheetPerson } from '@/lib/timesheet/types';
import { APP_COPY, fmt } from '@/locales';
import { loadPresenceRules } from './presence-db';

const MY_PAGE = LINKS.presence.myHours;
const OFFICE_PAGE = LINKS.presence.officeHours;
const messages = APP_COPY.timesheet.messages;

const attempt = <T extends object>(what: string, work: () => Promise<T>) =>
    attemptWrite(`Timesheet: ${what}`, { stale: messages.stale, notFound: messages.notFound }, work);

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
}

/** One person's day in Ore Ufficio */
export interface OfficeDayRow {
    person: TimesheetPerson;
    summary: DaySummary;
}

async function monthSources(): Promise<MonthSources> {
    const [rules, closedDays] = await Promise.all([loadPresenceRules(), listClosedDays()]);
    return { rules, closedDays, today: getTodayDate() };
}

const monthData = (period: { year: number; month: number }, sources: MonthSources): MonthData => ({
    ...period,
    today: sources.today,
    presets: { feriePresets: sources.rules.feriePresets, permessoPresets: sources.rules.permessoPresets },
});

/** The person behind the login: the operator their account is linked to, when of a timesheet category */
async function ownPerson(access: UserAccess, rules: PresenceRulesConfig): Promise<TimesheetPerson | null> {
    if (access.id === null) return null;
    const account = await findAccountById(access.id);
    return account?.operatorCode ? findTimesheetPerson(account.operatorCode, rules) : null;
}

/** Le mie ore: the logged-in person's month */
export async function getMyMonthAction(year: number, month: number): Promise<Result<MonthData & { person: TimesheetPerson; days: DaySummary[] }>> {
    const access = await authorize('view', MY_PAGE);
    return attempt('my month', async () => {
        const period = PeriodSchema.parse({ year, month });
        const sources = await monthSources();
        const person = await ownPerson(access, sources.rules);
        if (!person) throw new Error(fmt(messages.notLinked, { name: APP_CONFIG.OWNER_NAME }));
        const days = (await loadMonth([person], period.year, period.month, sources)).get(person.operatorCode) ?? [];
        return { ...monthData(period, sources), person, days };
    });
}

/** Ore Ufficio: the people of the timesheet, for the filter */
export async function getTimesheetPeopleAction(): Promise<Result<{ people: TimesheetPerson[] }>> {
    await authorize('view', OFFICE_PAGE);
    return attempt('people', async () => ({ people: await listTimesheetPeople(await loadPresenceRules()) }));
}

/** Ore Ufficio: everyone's month (or one person's), one row per person and day */
export async function getOfficeMonthAction(year: number, month: number, operatorCode?: string | null): Promise<Result<MonthData & { rows: OfficeDayRow[] }>> {
    await authorize('view', OFFICE_PAGE);
    return attempt('office month', async () => {
        const period = PeriodSchema.parse({ year, month });
        const sources = await monthSources();
        const everyone = await listTimesheetPeople(sources.rules);
        const people = operatorCode ? everyone.filter((person) => person.operatorCode === operatorCode) : everyone;
        const months = await loadMonth(people, period.year, period.month, sources);
        const rows = people.flatMap((person) => (months.get(person.operatorCode) ?? []).map((summary): OfficeDayRow => ({ person, summary })));
        return { ...monthData(period, sources), rows };
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
        const person = await writablePerson(access, CodeSchema.parse(request.operatorCode), await loadPresenceRules());
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

export async function deleteEntryAction(id: number, version: string): Promise<Saved> {
    const access = await authorize('edit', MY_PAGE, OFFICE_PAGE);
    return attempt('delete line', async () => {
        const entry = await getEntry(IdSchema.parse(id));
        if (!entry) throw new NotFound();
        await writablePerson(access, entry.operatorCode, await loadPresenceRules());
        await deleteEntry(access, entry.id, VersionSchema.parse(version));
        return {};
    });
}
