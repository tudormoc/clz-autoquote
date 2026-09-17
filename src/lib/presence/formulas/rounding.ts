import type { RoundingRule } from '../types';

// ============================================================================
// ROUNDING
// ============================================================================
// Shared by every formula that snaps hours to a grid (ordinarie, eccedenza).
//
// FORMULA: round(value / step) * step, with round = floor | nearest | ceil
// step = 0 disables rounding. Result is normalised to 2 decimals to avoid
// floating-point noise (e.g. 7.499999 → 7.5).
//
// EXAMPLES:
//   roundHours(7.3, { step: 0.5, mode: 'floor' })   → 7.0
//   roundHours(7.3, { step: 0.5, mode: 'nearest' }) → 7.5
//   roundHours(1.9, { step: 1,   mode: 'floor' })   → 1.0
// ============================================================================

export function roundHours(value: number, rule: RoundingRule): number {
    if (!(rule.step > 0)) return normalizeHours(value);
    const units = value / rule.step;
    const snapped =
        rule.mode === 'ceil' ? Math.ceil(units)
        : rule.mode === 'nearest' ? Math.round(units)
        : Math.floor(units);
    return normalizeHours(snapped * rule.step);
}

/** Round to 2 decimals — the precision of DECIMAL(5,2) in presence_hours_distribution. */
export function normalizeHours(value: number): number {
    return Math.round(value * 100) / 100;
}

/** Robust number coercion for values that may arrive as string/null from the DB. */
export function toHours(value: number | string | null | undefined): number {
    if (value === null || value === undefined || value === '') return 0;
    const n = typeof value === 'number' ? value : parseFloat(String(value));
    return Number.isFinite(n) ? n : 0;
}
