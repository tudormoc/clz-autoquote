import type { CategoryProfile, DayKind, DistributionProposal, HoursDistribution, PresenceRulesConfig } from '../types';
import { normalizeHours, roundHours } from './rounding';

// ============================================================================
// PREFILL DISTRIBUTION
// ============================================================================
// Decides what to write for one operator-day that has no distribution yet.
//
// FORMULA (W = workdayHours, w = worked hours):
//   1. w ≤ 0        → absenceField = W                         (category 'absence')
//   2. 0 < w < W    → ordinarie = round(w, ordinarieRounding)   (category 'partial')
//                     partialFillField = W − ordinarie
//   3. w ≥ W        → ordinarie = W                             (category 'full')
//                     excess = round(w − W, overflowRounding)
//                     overflowField = excess   if excess ≥ overflowMinHours
//
// INVARIANT: for every working-day proposal, sum(coveredFields) = W.
// Verified by `assertCoversWorkday` before anything is written.
//
// EXAMPLES (W = 8, ordinarie floor 0.5, overflow floor 0.5 min 0.5):
//   w = 0    → { ore_ferie: 8 }
//   w = 6.7  → { ore_ordinarie: 6.5, ore_permesso: 1.5 }
//   w = 9.4  → { ore_ordinarie: 8, banca_ore: 1 }
//   w = 8.25 → { ore_ordinarie: 8 }                     (excess 0.25 < 0.5)
//
// EXTRA DAY (distributeExtraDayHours, M = extraMaxHours):
//   w ≤ 0  → null (nothing written, nothing flagged)
//   w > 0  → extraField = min(M, round(w, extraRounding)); 0 after rounding → null
//   (M = 4, floor 0.5):  3.9 → 3.5   4.1 → 4   6 → 4   0.2 → null
//
// FIXED PROFILE (distributeFixedDay, e.g. office) — working day:
//   always { ore_ordinarie: W }, whatever the clock records say (even none).
//   Ferie / permesso / malattia are entered by hand; the never-overwrite
//   guard in the prefill keeps them.
//
// `distributeDay` dispatches on day kind + category profile; off days and
// 'none' profiles never get a proposal.
// ============================================================================

/** Entry point: proposal for one operator-day, or null when nothing should be written. */
export function distributeDay(
    worked: number,
    dayKind: DayKind,
    rules: PresenceRulesConfig,
    profile: CategoryProfile = 'standard'
): DistributionProposal | null {
    if (profile === 'none' || dayKind === 'off') return null;
    if (dayKind === 'extra') return distributeExtraDayHours(worked, rules);
    return profile === 'fixed' ? distributeFixedDay(rules) : distributeWorkedHours(worked, rules);
}

function distributeFixedDay(rules: PresenceRulesConfig): DistributionProposal {
    return { category: 'fixed', values: { ore_ordinarie: rules.workdayHours } };
}

function distributeExtraDayHours(worked: number, rules: PresenceRulesConfig): DistributionProposal | null {
    if (!(worked > 0)) return null;
    const hours = Math.min(rules.extraMaxHours, roundHours(worked, rules.extraRounding));
    if (!(hours > 0)) return null;
    return { category: 'extra', values: { [rules.extraField]: hours } };
}

function distributeWorkedHours(worked: number, rules: PresenceRulesConfig): DistributionProposal {
    const W = rules.workdayHours;

    if (!(worked > 0)) {
        return { category: 'absence', values: { [rules.absenceField]: W } };
    }

    if (worked < W) {
        const ordinarie = Math.min(roundHours(worked, rules.ordinarieRounding), W);
        const remainder = normalizeHours(W - ordinarie);
        return {
            category: 'partial',
            values: remainder > 0
                ? { ore_ordinarie: ordinarie, [rules.partialFillField]: remainder }
                : { ore_ordinarie: ordinarie },
        };
    }

    const excess = roundHours(worked - W, rules.overflowRounding);
    const values: DistributionProposal['values'] = { ore_ordinarie: W };
    if (excess >= rules.overflowMinHours && excess > 0) {
        values[rules.overflowField] = excess;
    }
    return { category: 'full', values };
}

/** True when any distribution value (hours or causale) has been entered for the row. */
export function hasAnyDistribution(dist: Partial<Record<keyof HoursDistribution, unknown>> | null | undefined): boolean {
    if (!dist) return false;
    const hasValue = (v: unknown) => v !== null && v !== undefined && String(v).trim() !== '';
    return (
        hasValue(dist.ore_ordinarie) ||
        hasValue(dist.ore_straordinarie) ||
        hasValue(dist.ore_ferie) ||
        hasValue(dist.causale_ferie) ||
        hasValue(dist.ore_permesso) ||
        hasValue(dist.causale_permesso) ||
        hasValue(dist.ore_malattia) ||
        hasValue(dist.banca_ore)
    );
}

/** Sum of the covered fields in a proposal — must equal workdayHours. */
export function proposalCoveredHours(proposal: DistributionProposal, rules: PresenceRulesConfig): number {
    return normalizeHours(rules.coveredFields.reduce((sum, f) => sum + (proposal.values[f] ?? 0), 0));
}

/** Working-day invariant. Extra-day proposals are exempt (they never cover a full day). */
export function assertCoversWorkday(proposal: DistributionProposal, rules: PresenceRulesConfig): boolean {
    if (proposal.category === 'extra') return true;
    return proposalCoveredHours(proposal, rules) === normalizeHours(rules.workdayHours);
}
