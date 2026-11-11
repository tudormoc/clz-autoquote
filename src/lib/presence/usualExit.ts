/**
 * The time a forgotten exit is dated at (owner, 2026-11-11): the person's usual exit time, read from the last real
 * exits, where "the last few days decide". Pure: the automatic exit (src/app/presence/auto-exit.ts) reads the presence
 * events and asks here. Every number comes from the settings (APP_CONFIG.PRESENCE.USUAL_EXIT); examples in
 * `npm run presence:examples`.
 *
 * The rule, best guess first (tested against every real exit of May–November 2026):
 * 1. who left with the others the last times gets the time the others left today (it follows the summer hours from
 *    the first day);
 * 2. else the person's own pattern: the last exits at the same time, or the most common time of the recent ones;
 * 3. else the time the others left today;
 * 4. else the standard time of the day.
 * A guess is used only when it is possible: after the person's own entry and the start of the work in progress, and
 * not in the future. When none is, the exit is dated at the moment of the check.
 */
import { APP_CONFIG } from '@/config/constants';
import { PRESENCE_EXIT } from './events';

export interface UsualExitSettings {
    /** Exit times are read by this step, rounded down */
    stepMinutes: number;
    /** Who left with the others this many last times gets the others' time of today */
    withOthersExits: number;
    /** Own pattern: this many last exits at the same time … */
    sameLastExits: number;
    /** … or, among this many last exits, at least `recentAgree` at the same time */
    recentExits: number;
    recentAgree: number;
    /** "The time the others left" needs this many exits that day, and this share of them at the same time */
    othersMin: number;
    othersShare: number;
    /** Writers of exits that teach nothing (automatic, typed in afterwards) */
    notRealWriters: readonly string[];
}

const CONFIG = APP_CONFIG.PRESENCE.USUAL_EXIT;
export const USUAL_EXIT_SETTINGS: UsualExitSettings = {
    stepMinutes: CONFIG.STEP_MINUTES,
    withOthersExits: CONFIG.WITH_OTHERS_EXITS,
    sameLastExits: CONFIG.SAME_LAST_EXITS,
    recentExits: CONFIG.RECENT_EXITS,
    recentAgree: CONFIG.RECENT_AGREE,
    othersMin: CONFIG.OTHERS_MIN,
    othersShare: CONFIG.OTHERS_SHARE,
    notRealWriters: CONFIG.NOT_REAL_WRITERS,
};

/** "HH:MM:SS" (or "HH:MM") → seconds since midnight */
export function clockToSeconds(time: string): number {
    const [hours = 0, minutes = 0, seconds = 0] = time.split(':').map(Number);
    return hours * 3600 + minutes * 60 + seconds;
}

/** Seconds since midnight → "HH:MM:SS" */
export function secondsToClock(total: number): string {
    const two = (n: number) => String(n).padStart(2, '0');
    return `${two(Math.floor(total / 3600))}:${two(Math.floor((total % 3600) / 60))}:${two(total % 60)}`;
}

/** The step an exit falls in, as minutes since midnight: 16:34:10 → 16:30 with half-hour steps */
export const exitSlot = (second: number, settings: UsualExitSettings = USUAL_EXIT_SETTINGS): number =>
    Math.floor(second / 60 / settings.stepMinutes) * settings.stepMinutes;

/** A presence event of a day, as read from EVENTI */
export interface DayStamp {
    operator: string;
    /** "YYYY-MM-DD" */
    day: string;
    /** "HH:MM:SS" */
    time: string;
    evento: string;
    /** EVENTI.UTENTE: who wrote it */
    writer: string;
    progressivo: number;
}

/** The last presence event of each person-day (an exit after an entry of the same instant) */
export function lastStamps(stamps: readonly DayStamp[]): DayStamp[] {
    const last = new Map<string, DayStamp>();
    for (const stamp of stamps) {
        const key = `${stamp.operator}|${stamp.day}`;
        const old = last.get(key);
        const later =
            !old ||
            stamp.time > old.time ||
            (stamp.time === old.time && (stamp.progressivo > old.progressivo || (stamp.progressivo === old.progressivo && stamp.evento === PRESENCE_EXIT)));
        if (later) last.set(key, stamp);
    }
    return [...last.values()];
}

/** A real exit: the person's last presence event of a day, when it is an exit somebody really made */
export interface RealExit {
    operator: string;
    day: string;
    second: number;
    /** Its step, minutes since midnight */
    slot: number;
}

/** The real exits among the presence events: days closed by an automatic or typed-in exit, or left open, teach nothing */
export function realExits(stamps: readonly DayStamp[], settings: UsualExitSettings = USUAL_EXIT_SETTINGS): RealExit[] {
    return lastStamps(stamps)
        .filter((stamp) => stamp.evento === PRESENCE_EXIT && !settings.notRealWriters.includes(stamp.writer))
        .map((stamp) => {
            const second = clockToSeconds(stamp.time);
            return { operator: stamp.operator, day: stamp.day, second, slot: exitSlot(second, settings) };
        });
}

/** The value that comes at least `need` times among `values` (newest first); between equals the newest wins */
export function mostCommon(values: readonly number[], need: number): number | null {
    const counts = new Map<number, number>();
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
    let best: number | null = null;
    for (const value of values) {
        const count = counts.get(value) ?? 0;
        if (count >= need && (best === null || count > (counts.get(best) ?? 0))) best = value;
    }
    return best;
}

/**
 * The time the others left: the most common step of a day's exits, when enough people left and enough of them
 * together. Between two times just as common the earlier one counts (a forgotten exit is not given extra time).
 */
export function othersSlot(slots: readonly number[], settings: UsualExitSettings = USUAL_EXIT_SETTINGS): number | null {
    if (slots.length < settings.othersMin) return null;
    return mostCommon([...slots].sort((a, b) => a - b), Math.ceil(slots.length * settings.othersShare));
}

/** A past exit of a person, with the time the others left that day (null: too few of them) */
export interface PastExit {
    day: string;
    slot: number;
    others: number | null;
}

/**
 * A person's last real exits before `today`, newest first, only on days `sameKind` accepts (working days are learned
 * apart from Saturdays), each with the time the others left that day.
 */
export function pastExitsOf(operator: string, exits: readonly RealExit[], today: string, sameKind: (day: string) => boolean, settings: UsualExitSettings = USUAL_EXIT_SETTINGS): PastExit[] {
    const needed = Math.max(settings.recentExits, settings.sameLastExits, settings.withOthersExits);
    return exits
        .filter((exit) => exit.operator === operator && exit.day < today && sameKind(exit.day))
        .sort((a, b) => b.day.localeCompare(a.day))
        .slice(0, needed)
        .map((exit) => ({
            day: exit.day,
            slot: exit.slot,
            others: othersSlot(exits.filter((other) => other.day === exit.day && other.operator !== operator).map((other) => other.slot), settings),
        }));
}

/** Why an exit time was chosen */
export type ExitReason = 'withOthers' | 'lastExits' | 'recentExits' | 'othersToday' | 'standard' | 'now';

/** A guess of the exit time: minutes since midnight, and why */
export interface ExitGuess {
    minutes: number;
    reason: Exclude<ExitReason, 'now'>;
}

/**
 * The guesses for a person, best first: `past` are the person's last real exits (newest first), `othersToday` the
 * time the others left today (null: unknown), `standard` the day's standard time in minutes.
 */
export function exitGuesses(past: readonly PastExit[], othersToday: number | null, standard: number, settings: UsualExitSettings = USUAL_EXIT_SETTINGS): ExitGuess[] {
    const guesses: ExitGuess[] = [];
    const add = (minutes: number, reason: ExitGuess['reason']) => {
        if (!guesses.some((guess) => guess.minutes === minutes)) guesses.push({ minutes, reason });
    };

    const lastOnes = past.slice(0, settings.withOthersExits);
    const leavesWithOthers = lastOnes.length === settings.withOthersExits && lastOnes.every((exit) => exit.others !== null && exit.slot === exit.others);
    if (leavesWithOthers && othersToday !== null) add(othersToday, 'withOthers');

    const slots = past.map((exit) => exit.slot);
    const last = slots.slice(0, settings.sameLastExits);
    if (last.length === settings.sameLastExits && last.every((slot) => slot === last[0])) add(last[0], 'lastExits');
    else {
        const recent = mostCommon(slots.slice(0, settings.recentExits), settings.recentAgree);
        if (recent !== null) add(recent, 'recentExits');
    }

    if (othersToday !== null) add(othersToday, 'othersToday');
    add(standard, 'standard');
    return guesses;
}

/** The exit chosen: the second of the day it is dated at, and why */
export interface ExitChoice {
    second: number;
    reason: ExitReason;
}

/**
 * The first guess that is possible: later than `after` (the person's entry, or the start of the work in progress: the
 * pause of that work is written one second before the exit) and not later than `now`. When none is, the moment of the
 * check itself; null when even that is too early.
 */
export function chooseExit(guesses: readonly ExitGuess[], after: number, now: number): ExitChoice | null {
    const possible = (second: number) => second - 1 > after && second <= now;
    for (const guess of guesses) {
        if (possible(guess.minutes * 60)) return { second: guess.minutes * 60, reason: guess.reason };
    }
    return possible(now) ? { second: now, reason: 'now' } : null;
}
