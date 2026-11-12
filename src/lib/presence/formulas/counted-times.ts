import type { CategoryProfile, ClockDay, CountedDay, DayKind, PresenceRulesConfig } from '../types';
import { normalizeHours } from './rounding';

// ============================================================================
// COUNTED TIMES ("Totale Ore")
// ============================================================================
// Turns the raw first clock-in / last clock-out of a day into the counted
// start / end and the worked hours. Every number comes from the rules:
//   shiftStarts, shiftSnapWindowMinutes, entryRoundingMinutes,
//   exitRoundingMinutes, pauseMinutes.
//
// ENTRY RULE (countEntry):
//   1. If the clock-in is within shiftSnapWindowMinutes BEFORE a shift start,
//      or up to entryGraceMinutes AFTER it → counted from that shift start.
//   2. Otherwise → clock-in rounded UP to entryRoundingMinutes (penalty).
//   Shifts 06:30/07:30/08:30, window 30, step 15:
//     06:12 → 06:30   06:30 → 06:30   06:31 → 06:45   06:59 → 07:00
//     07:00 → 07:30   07:24 → 07:30   07:31 → 07:45
//
// EXIT RULE (countExit):
//   Last clock-out rounded DOWN to exitRoundingMinutes (penalty).
//     15:29 → 15:15   15:30 → 15:30   15:46 → 15:45   16:34 → 16:30
//
// PAUSE RULE (pauseApplies):
//   The pause is flat (intermediate clock-outs / clock-ins are ignored) and is
//   deducted only when the counted span covers the whole pause window
//   [pauseWindowStart, pauseWindowEnd]: countedStart ≤ start AND countedEnd ≥ end.
//   Window 12:00–13:00:
//     07:30 → 16:30  covers it   → pause deducted
//     07:30 → 12:00  ends before → no pause (left before lunch)
//     13:30 → 17:30  starts after→ no pause (afternoon only)
//
// WORKED HOURS (computeCountedDay) — working day:
//   worked = (countedEnd − countedStart − pause) / 60, never < 0.
//     06:12 → 16:34  ⇒ 06:30 → 16:30 = 10:00 − 1:00 = 9.0
//     07:25 → 16:58  ⇒ 07:30 → 16:45 =  9:15 − 1:00 = 8.25
//     07:01 → 12:10  ⇒ 07:30 → 12:00 =  4:30 − 0    = 4.5
//
// COMPENSATION (compensateMinorShortfall) — forgive small penalties:
//   real = Σ clocked session minutes; if only one session was clocked and the
//          pause applies, the flat pause is assumed taken and subtracted.
//   if 0 < workday − worked ≤ compensationToleranceMinutes
//      AND real ≥ workday − realMinutesTolerance   → worked = workday.
//     07:32→12:06 + 12:58→16:33: penalised 07:45→16:30 −1h = 7:45 (short 15),
//     real 4:34 + 3:35 = 8:09 ≥ 8:00 → granted 8.0.
//     07:31→16:30 single session: real 8:59 − 1:00 = 7:59 < 8:00 → stays 7.75.
//
// EXTRA DAY (e.g. Saturday) — no shift snap, no penalties, no pause:
//   worked = (lastExit − firstEntry) / 60, raw timestamps.
//     06:12 → 10:20 ⇒ 4.13
//
// FIXED PROFILE (e.g. office) — working days are shown raw as well (no snap,
//   no penalties, no pause); the prefill ignores the value and writes flat hours.
//
// OFF DAY — nothing is counted (workedHours = 0, times null).
//
// Worked examples used as regression tests: ../examples.ts
// ============================================================================

/** "HH:MM" or "HH:MM:SS" → minutes since midnight. */
export function timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
}

/** Minutes since midnight → "HH:MM". */
export function minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function ceilTo(value: number, step: number): number {
    return step > 0 ? Math.ceil(value / step) * step : value;
}

function floorTo(value: number, step: number): number {
    return step > 0 ? Math.floor(value / step) * step : value;
}

/** Apply the entry rule. Returns counted start (minutes) and the matched shift start, if any. */
function countEntry(
    clockInMinutes: number,
    rules: PresenceRulesConfig
): { countedStart: number; shiftStart: number | null } {
    for (const shift of rules.shiftStarts) {
        const shiftMin = timeToMinutes(shift);
        const lead = shiftMin - clockInMinutes; // > 0 when arriving before the shift
        if (lead <= rules.shiftSnapWindowMinutes && -lead <= rules.entryGraceMinutes) {
            return { countedStart: shiftMin, shiftStart: shiftMin };
        }
    }
    return { countedStart: ceilTo(clockInMinutes, rules.entryRoundingMinutes), shiftStart: null };
}

/** Apply the exit rule. Returns counted end (minutes). */
function countExit(clockOutMinutes: number, rules: PresenceRulesConfig): number {
    return floorTo(clockOutMinutes, rules.exitRoundingMinutes);
}

/** Pause rule: deducted only when the counted span covers the whole pause window. */
function pauseApplies(countedStartMin: number, countedEndMin: number, rules: PresenceRulesConfig): boolean {
    return countedStartMin <= timeToMinutes(rules.pauseWindowStart) && countedEndMin >= timeToMinutes(rules.pauseWindowEnd);
}

const EMPTY_DAY: CountedDay = { shiftStart: null, countedStart: null, countedEnd: null, workedHours: 0, compensated: false };

/**
 * Compensation rule: returns the worked minutes to use, forgiving a minor
 * shortfall when the real clocked minutes reach the workday.
 */
function compensateMinorShortfall(
    workedMinutes: number,
    clock: ClockDay,
    pauseDeducted: boolean,
    rules: PresenceRulesConfig
): { workedMinutes: number; compensated: boolean } {
    const tolerance = rules.compensationToleranceMinutes;
    const workdayMinutes = Math.round(rules.workdayHours * 60);
    const shortfall = workdayMinutes - workedMinutes;
    if (!(tolerance > 0) || shortfall <= 0 || shortfall > tolerance) return { workedMinutes, compensated: false };
    if (clock.sessionMinutes === null || clock.sessionMinutes === undefined) return { workedMinutes, compensated: false };

    // Single session with the pause window covered → pause not clocked, assume it was taken
    const assumedPause = (clock.sessions ?? 1) <= 1 && pauseDeducted ? rules.pauseMinutes : 0;
    const realMinutes = clock.sessionMinutes - assumedPause;
    return realMinutes >= workdayMinutes - rules.realMinutesTolerance
        ? { workedMinutes: workdayMinutes, compensated: true }
        : { workedMinutes, compensated: false };
}

/**
 * Full day computation from raw clock data.
 * A day with no clock-in yields workedHours = 0 and null counted times.
 */
export function computeCountedDay(
    clock: ClockDay,
    rules: PresenceRulesConfig,
    dayKind: DayKind = 'working',
    profile: CategoryProfile = 'standard'
): CountedDay {
    const { firstEntry, lastExit } = clock;
    if (!firstEntry || dayKind === 'off') return EMPTY_DAY;
    if (dayKind === 'extra' || profile !== 'standard') return computeRawDay(firstEntry, lastExit);

    const entry = countEntry(timeToMinutes(firstEntry), rules);
    const countedStart = minutesToTime(entry.countedStart);
    const shiftStart = entry.shiftStart !== null ? minutesToTime(entry.shiftStart) : null;

    if (!lastExit) {
        return { shiftStart, countedStart, countedEnd: null, workedHours: 0, compensated: false };
    }

    const countedEndMin = countExit(timeToMinutes(lastExit), rules);
    const pauseDeducted = pauseApplies(entry.countedStart, countedEndMin, rules);
    const penalised = Math.max(0, countedEndMin - entry.countedStart - (pauseDeducted ? rules.pauseMinutes : 0));
    const { workedMinutes, compensated } = compensateMinorShortfall(penalised, clock, pauseDeducted, rules);

    return {
        shiftStart,
        countedStart,
        countedEnd: minutesToTime(countedEndMin),
        workedHours: normalizeHours(workedMinutes / 60),
        compensated,
    };
}

/** Raw span: no rounding, no pause (extra days, fixed-profile categories). */
function computeRawDay(firstEntry: string, lastExit: string | null | undefined): CountedDay {
    const startMin = timeToMinutes(firstEntry);
    const countedStart = minutesToTime(startMin);
    if (!lastExit) return { shiftStart: null, countedStart, countedEnd: null, workedHours: 0, compensated: false };

    const endMin = timeToMinutes(lastExit);
    return {
        shiftStart: null,
        countedStart,
        countedEnd: minutesToTime(endMin),
        workedHours: normalizeHours(Math.max(0, endMin - startMin) / 60),
        compensated: false,
    };
}
