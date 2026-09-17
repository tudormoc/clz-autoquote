import type { DayKind, PresenceRulesConfig } from './types';

// ============================================================================
// CALENDAR HELPERS (all dates are 'YYYY-MM-DD' strings, local time)
// ============================================================================

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export function isoWeekday(dateStr: string): number {
    const [y, m, d] = dateStr.split('-').map(Number);
    const day = new Date(y, m - 1, d, 12).getDay(); // 0 = Sun
    return day === 0 ? 7 : day;
}

/** Resolve the kind of a date. A weekday listed in both lists counts as working. */
export function getDayKind(dateStr: string, rules: PresenceRulesConfig): DayKind {
    const wd = isoWeekday(dateStr);
    if (rules.workingDays.includes(wd)) return 'working';
    if (rules.extraDays.includes(wd)) return 'extra';
    return 'off';
}

export function isWorkingDay(dateStr: string, rules: PresenceRulesConfig): boolean {
    return getDayKind(dateStr, rules) === 'working';
}

/** A day the prefill may touch: working or extra day, strictly before today. */
export function isPrefillableDay(dateStr: string, todayStr: string, rules: PresenceRulesConfig): boolean {
    return dateStr < todayStr && getDayKind(dateStr, rules) !== 'off';
}

/** Every calendar date from `from` to `to` inclusive. */
export function eachDateInRange(from: string, to: string): string[] {
    const [sy, sm, sd] = from.split('-').map(Number);
    const [ey, em, ed] = to.split('-').map(Number);
    const cur = new Date(sy, sm - 1, sd, 12);
    const end = new Date(ey, em - 1, ed, 12);
    const out: string[] = [];
    while (cur <= end) {
        out.push(formatDate(cur));
        cur.setDate(cur.getDate() + 1);
    }
    return out;
}

/** Today as 'YYYY-MM-DD' in local time (not UTC — the plant runs on local clock). */
export function todayLocal(now: Date = new Date()): string {
    return formatDate(now);
}

function formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
