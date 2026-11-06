/**
 * Timesheet types shared by the server (src/lib/timesheet/db, src/app/presence/timesheet-actions.ts) and the screens
 * (src/components/timesheet). Words: an entry (riga) is one piece of a person's day; a day summary is what the day
 * adds up to, as the studio gets it. How it all works: docs/TIMESHEET.md.
 */

/** What one line of a day can be. A new kind: here, in KIND_SPECS (kinds.ts) and in it.ts → timesheet.kinds. */
export const ENTRY_KINDS = ['work', 'permesso', 'ferie', 'malattia', 'straordinarie', 'banca_ore'] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

/** One line of a person's day as stored (timesheet_entries) */
export interface Entry {
    id: number;
    operatorCode: string;
    /** YYYY-MM-DD */
    day: string;
    kind: EntryKind;
    /** Work: "HH:MM" of the entry; the other kinds: null */
    timeFrom: string | null;
    /** Work: "HH:MM" of the exit, null while the person is still in */
    timeTo: string | null;
    /** Every kind but work: its hours */
    hours: number | null;
    /** Ferie / permesso: the type picked from the quick texts of Regole Presenze; '' = none */
    causale: string;
    /** A free word of the person; '' = none */
    note: string;
    /** For the "changed meanwhile" check */
    version: string;
}

/** What the day editor sends; the person and the day are given apart and never change on a line */
export interface EntryInput {
    kind: EntryKind;
    timeFrom: string | null;
    timeTo: string | null;
    hours: number | null;
    causale: string;
    note: string;
}

/** The hour columns of a day, as the studio's file has them */
export const HOUR_FIELDS = ['ordinarie', 'ferie', 'permesso', 'malattia', 'straordinarie', 'bancaOre'] as const;
export type HourField = (typeof HOUR_FIELDS)[number];
export type DayHours = Record<HourField, number>;

/**
 * open: a work line without an exit · short: a past day below its workday · pending: today or later, not covered yet
 * (no alert) · ok: covered, or nothing expected · free: nothing expected and nothing entered (weekend) · closed: a
 * company closed day, counted as ferie by itself
 */
export type DayStatus = 'open' | 'short' | 'pending' | 'ok' | 'free' | 'closed';

/** What a person's day adds up to */
export interface DaySummary {
    /** YYYY-MM-DD */
    day: string;
    entries: Entry[];
    hours: DayHours;
    /** The types of the ferie / permesso lines ("FESTA"; several joined by a comma), '' when none */
    causaleFerie: string;
    causalePermesso: string;
    /** Hours the day must cover: the person's workday on a working day, 0 on a weekend or a closed day */
    expected: number;
    /** What is still missing of `expected` */
    missing: number;
    status: DayStatus;
    /** The company closed day it is (its name in Giorni di chiusura), null when the office is open */
    closedReason: string | null;
}

/** A closed span of work of a day ("08:00" to "12:00") */
export interface WorkSpan {
    from: string;
    to: string;
}

/** The work spans one click writes into an empty day (src/lib/timesheet/normalDay.ts), and the hours they add up to */
export interface NormalDay {
    spans: WorkSpan[];
    hours: number;
}

/** What Regole Presenze fixes for the timesheet: its first day and the picks of Dalle / Alle */
export interface TimesheetBounds {
    /** YYYY-MM-DD: days before it are shown but locked */
    startDay: string;
    /** "HH:MM": the first and last pick of Dalle / Alle (the company's open hours) */
    firstTime: string;
    lastTime: string;
}

/** Someone who enters their hours here: a NetPro operator of a timesheet category */
export interface TimesheetPerson {
    operatorCode: string;
    name: string;
    /** NetPro matricola, the "Codice SARP net" of the studio's file */
    matricola: string | null;
    /** The person's workday (ORE_GIORNATA, or their exception in ORE_GIORNATA_OPERATORE) */
    workdayHours: number;
}
