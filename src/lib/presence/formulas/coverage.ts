import type { DayStatus, HoursDistribution, PresenceRulesConfig } from '../types';
import { getDayKind } from '../calendar';
import { normalizeHours, toHours } from './rounding';

// ============================================================================
// COVERAGE CHECK ("Controllo 8h")
// ============================================================================
// WORKING DAY:
//   covered = Σ row[f] for f in coveredFields
//   status  = future       if date ≥ today
//           = ok           if covered = workdayHours
//           = empty        if covered = 0
//           = mismatch     otherwise
//
// EXTRA DAY (e.g. Saturday):
//   covered = row[extraField]
//   status  = non-working  if no clock records (nothing expected)
//           = future       if date ≥ today
//           = ok           if covered > 0
//           = empty        otherwise (records exist but hours not distributed)
//
// OFF DAY: always non-working.
//
// Only 'mismatch' and 'empty' count as anomalies. Non-working days and
// today/future are never flagged — they are informational.
// ============================================================================

export function getCoveredHours(row: Partial<HoursDistribution>, rules: PresenceRulesConfig): number {
    const sum = rules.coveredFields.reduce(
        (acc, f) => acc + toHours(row[f as keyof HoursDistribution] as number | string | null | undefined),
        0
    );
    return normalizeHours(sum);
}

/** Hours recorded on an extra day (the single extraField). */
export function getExtraDayHours(row: Partial<HoursDistribution>, rules: PresenceRulesConfig): number {
    return normalizeHours(toHours(row[rules.extraField as keyof HoursDistribution] as number | string | null | undefined));
}

export function getDayStatus(
    row: Partial<HoursDistribution> & { data: string; ore_totali?: number },
    todayStr: string,
    rules: PresenceRulesConfig
): DayStatus {
    const dayKind = getDayKind(row.data, rules);

    if (dayKind === 'off') {
        return { kind: 'non-working', dayKind, covered: getCoveredHours(row, rules) };
    }

    if (dayKind === 'extra') {
        const covered = getExtraDayHours(row, rules);
        const hasRecords = (row.ore_totali ?? 0) > 0;
        if (!hasRecords && covered === 0) return { kind: 'non-working', dayKind, covered };
        if (row.data >= todayStr) return { kind: 'future', dayKind, covered };
        if (covered > 0) return { kind: 'ok', dayKind, covered };
        return { kind: 'empty', dayKind, covered };
    }

    const covered = getCoveredHours(row, rules);
    if (row.data >= todayStr) return { kind: 'future', dayKind, covered };
    if (covered === normalizeHours(rules.workdayHours)) return { kind: 'ok', dayKind, covered };
    if (covered === 0) return { kind: 'empty', dayKind, covered };
    return { kind: 'mismatch', dayKind, covered };
}

/** A past working day whose covered hours ≠ workdayHours (includes empty days). */
export function isCoverageAnomaly(status: DayStatus): boolean {
    return status.kind === 'mismatch' || status.kind === 'empty';
}
