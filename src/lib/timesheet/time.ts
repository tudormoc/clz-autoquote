/**
 * Times and hours of the timesheet move in steps (APP_CONFIG.TIMESHEET.STEP_MINUTES, half hours): what the pickers
 * offer, what the checks accept, and "now" as the Entra / Esci buttons stamp it.
 */

import { APP_CONFIG } from '@/config/constants';
import { minutesToTime, timeToMinutes } from '@/lib/presence';

const { STEP_MINUTES, MAX_HOURS } = APP_CONFIG.TIMESHEET;
const MINUTES_IN_DAY = 24 * 60;

/** The step as hours (0.5) */
export const STEP_HOURS = STEP_MINUTES / 60;

/** "08:30" sits on a step; "08:15" does not */
export const isStepTime = (time: string) => timeToMinutes(time) % STEP_MINUTES === 0;

/** 8.5 sits on a step; 8.25 does not */
export const isStepHours = (hours: number) => Math.round(hours * 60) % STEP_MINUTES === 0;

/** Hours between two "HH:MM" of the same day */
export const spanHours = (from: string, to: string) => (timeToMinutes(to) - timeToMinutes(from)) / 60;

/** The time of `now` moved to the nearest step ("08:12" → "08:00", "08:16" → "08:30"), never past the day's last step */
export function nearestStepTime(now: Date): string {
    const rounded = Math.round((now.getHours() * 60 + now.getMinutes()) / STEP_MINUTES) * STEP_MINUTES;
    return minutesToTime(Math.min(rounded, MINUTES_IN_DAY - STEP_MINUTES));
}

/** Every time of a day a picker offers: "00:00", "00:30" … "23:30" */
export const TIME_OPTIONS: readonly string[] = Array.from({ length: MINUTES_IN_DAY / STEP_MINUTES }, (_, i) => minutesToTime(i * STEP_MINUTES));

/** Every number of hours a picker offers: 0.5, 1 … MAX_HOURS */
export const HOURS_OPTIONS: readonly number[] = Array.from({ length: Math.floor(MAX_HOURS / STEP_HOURS) }, (_, i) => (i + 1) * STEP_HOURS);
