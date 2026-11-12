import { weekdayOf } from '@/lib/dateUtils';
import type { DayKind, PresenceRulesConfig } from './types';

// ============================================================================
// THE PRESENCE CALENDAR: which days are worked (dates are 'YYYY-MM-DD' strings).
// The date arithmetic itself (day of the week, every date of a range) is src/lib/dateUtils.ts.
// ============================================================================

/** Resolve the kind of a date. A weekday listed in both lists counts as working. */
export function getDayKind(dateStr: string, rules: PresenceRulesConfig): DayKind {
    const wd = weekdayOf(dateStr);
    if (rules.workingDays.includes(wd)) return 'working';
    if (rules.extraDays.includes(wd)) return 'extra';
    return 'off';
}

/** A day the prefill may touch: working or extra day, strictly before today. */
export function isPrefillableDay(dateStr: string, todayStr: string, rules: PresenceRulesConfig): boolean {
    return dateStr < todayStr && getDayKind(dateStr, rules) !== 'off';
}
