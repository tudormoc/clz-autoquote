import type { HoursDistributionField } from '@/types';
import type { HoursDistribution, PresenceRulesConfig } from '../types';
import { toHours } from './rounding';

// ============================================================================
// EDIT SIDE EFFECTS
// ============================================================================
// When a user edits one cell, some other cells must follow. This is the only
// place that knows those rules. The server decides them from the stored day and
// writes the cell and its follow-ups in one statement (updateHoursDistributionAction,
// through editChanges below); the table shows what the server says it saved.
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

function resolveEditSideEffects(
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

/** The columns of an hours day that hold a text (the causali); every other one holds hours */
const TEXT_FIELDS: readonly HoursDistributionField[] = ['causale_ferie', 'causale_permesso'];

/** An edited cell as it is stored: a text trimmed, hours as a number; an empty cell, or hours that are no number, as null */
function storedEditValue(field: HoursDistributionField, value: number | string | null | undefined): number | string | null {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    if (TEXT_FIELDS.includes(field)) return String(value).trim();
    const hours = parseFloat(String(value));
    return Number.isNaN(hours) ? null : hours;
}

/**
 * Everything one edit writes on a day: the edited cell (as stored) and the cells that must follow it. `stored` is
 * what the day holds now. All of it is saved together, or none.
 */
export function editChanges(
    stored: Partial<HoursDistribution>,
    field: HoursDistributionField,
    value: number | string | null | undefined,
    rules: PresenceRulesConfig
): DistributionPatch {
    const edited = storedEditValue(field, value);
    return { [field]: edited, ...resolveEditSideEffects(stored, field, edited, rules) };
}
