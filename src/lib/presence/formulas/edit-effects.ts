import type { HoursDistributionField } from '@/types';
import type { HoursDistribution, PresenceRulesConfig } from '../types';
import { toHours } from './rounding';

// ============================================================================
// EDIT SIDE EFFECTS
// ============================================================================
// When a user edits one cell, some other cells must follow. This is the only
// place that knows those rules; the table just applies the returned patch.
//
// RULES:
//   1. Entering hours > 0 in partialFillField (permesso) or ore_malattia
//      clears ore_ferie + causale_ferie — a day cannot be both.
//   2. Setting causale_ferie on a row with no ferie hours fills
//      ore_ferie = workdayHours (a tagged holiday is a full day).
//
// Returns the patch to apply on top of the edited field (never includes the
// edited field itself). Empty object = no side effects.
// ============================================================================

export type DistributionPatch = Partial<Record<HoursDistributionField, number | string | null>>;

export function resolveEditSideEffects(
    row: Partial<HoursDistribution>,
    field: HoursDistributionField,
    newValue: number | string | null,
    rules: PresenceRulesConfig
): DistributionPatch {
    const patch: DistributionPatch = {};

    // Rule 1
    const clearsFerie = field !== 'ore_ferie' && (field === rules.partialFillField || field === 'ore_malattia');
    if (clearsFerie && toHours(newValue) > 0) {
        if (toHours(row.ore_ferie) > 0 || row.causale_ferie) {
            patch.ore_ferie = null;
            patch.causale_ferie = null;
        }
    }

    // Rule 2
    if (field === 'causale_ferie' && newValue && toHours(row.ore_ferie) <= 0) {
        patch.ore_ferie = rules.workdayHours;
    }

    return patch;
}
