/**
 * Times and hours of the timesheet move in steps (APP_CONFIG.TIMESHEET.STEP_MINUTES, half hours): what the pickers
 * offer and what the checks accept.
 */

import { APP_CONFIG } from '@/config/constants';
import { minutesToTime, timeToMinutes } from '@/lib/presence';

const { STEP_MINUTES } = APP_CONFIG.TIMESHEET;

/** The step as hours (0.5) */
const STEP_HOURS = STEP_MINUTES / 60;

/** "08:30" sits on a step; "08:15" does not */
export const isStepTime = (time: string) => timeToMinutes(time) % STEP_MINUTES === 0;

/** 8.5 sits on a step; 8.25 does not */
export const isStepHours = (hours: number) => Math.round(hours * 60) % STEP_MINUTES === 0;

/** Hours between two "HH:MM" of the same day */
export const spanHours = (from: string, to: string) => (timeToMinutes(to) - timeToMinutes(from)) / 60;

/** Every time a picker offers between the first and last pick of Regole Presenze: "07:00", "07:30" … "19:00" */
export function timeOptions(firstTime: string, lastTime: string): string[] {
    const first = timeToMinutes(firstTime);
    const steps = Math.floor((timeToMinutes(lastTime) - first) / STEP_MINUTES);
    return steps < 0 ? [] : Array.from({ length: steps + 1 }, (_, i) => minutesToTime(first + i * STEP_MINUTES));
}

/**
 * Alle proposed when Dalle moves on a new work line: the span it had, kept and shifted; the first line of a day
 * proposes half the workday (the morning, owner 2026-11-05: 08:30 picked, 8 h person → 12:30). Never past the
 * last pick; null when nothing sensible remains.
 */
export function shiftedEnd(newFrom: string, currentFrom: string | null, currentTo: string | null, workdayHours: number, lastTime: string): string | null {
    const length =
        currentFrom && currentTo
            ? timeToMinutes(currentTo) - timeToMinutes(currentFrom)
            : Math.round((workdayHours * 60) / 2 / STEP_MINUTES) * STEP_MINUTES;
    const from = timeToMinutes(newFrom);
    const to = Math.min(from + Math.max(length, STEP_MINUTES), timeToMinutes(lastTime));
    return to > from ? minutesToTime(to) : null;
}

/** The numbers of hours a picker offers: 0.5, 1 … the person's own workday */
export const hoursOptions = (maxHours: number): number[] => Array.from({ length: Math.floor(maxHours / STEP_HOURS) }, (_, i) => (i + 1) * STEP_HOURS);
