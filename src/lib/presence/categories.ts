import { PRESENCE_RULES } from '@/config/constants';
import type { OperatorHoursRow } from '@/types';
import type { CategoryProfile } from './types';

// ============================================================================
// EMPLOYEE CATEGORIES (OPERATORI.ENTITA → dashboard category)
// ============================================================================
// Edit the list in src/config/constants.ts → PRESENCE_RULES.CATEGORIES.
// ============================================================================

export const OTHER_CATEGORY_KEY = 'altro';

export interface EmployeeCategory {
    key: string;
    label: string;
    defaultActive: boolean;
    /** Which formulas "Precompila" applies to this category. */
    profile: CategoryProfile;
}

/** Known categories, in display order (without "Altro"). */
export const EMPLOYEE_CATEGORIES: readonly EmployeeCategory[] = PRESENCE_RULES.CATEGORIES.map((c) => ({
    key: c.reparto,
    label: c.label,
    defaultActive: c.defaultActive,
    profile: c.profile,
}));

export const OTHER_CATEGORY: EmployeeCategory = {
    key: OTHER_CATEGORY_KEY,
    label: PRESENCE_RULES.OTHER_CATEGORY_LABEL,
    defaultActive: false,
    profile: 'none',
};

/** ENTITA values that belong to the presence system (used to list operators and to prefill). */
export const TRACKED_REPARTI: readonly string[] = EMPLOYEE_CATEGORIES.map((c) => c.key);

/** Categories the prefill applies to (profile ≠ 'none'). */
export const PREFILL_CATEGORIES: readonly EmployeeCategory[] = EMPLOYEE_CATEGORIES.filter((c) => c.profile !== 'none');

/** ENTITA values the prefill applies to. */
export const PREFILL_REPARTI: readonly string[] = PREFILL_CATEGORIES.map((c) => c.key);

/** Rule profile for a raw ENTITA value ('none' when unknown). */
export function profileFromReparto(reparto: string | null | undefined): CategoryProfile {
    const key = normalizeReparto(reparto);
    return EMPLOYEE_CATEGORIES.find((c) => c.key === key)?.profile ?? 'none';
}

export const DEFAULT_ACTIVE_CATEGORY_KEYS: readonly string[] = EMPLOYEE_CATEGORIES
    .filter((c) => c.defaultActive)
    .map((c) => c.key);

/** Map a raw ENTITA value to a category key ('altro' when unknown). */
export function normalizeReparto(reparto: string | null | undefined): string {
    const r = (reparto ?? '').trim();
    return TRACKED_REPARTI.includes(r) ? r : OTHER_CATEGORY_KEY;
}

export function categoriaFromReparto(reparto: string | null | undefined): OperatorHoursRow['categoria'] {
    const key = normalizeReparto(reparto);
    const match = EMPLOYEE_CATEGORIES.find((c) => c.key === key);
    return (match?.label ?? OTHER_CATEGORY.label) as OperatorHoursRow['categoria'];
}

/** SQL fragment: `OPE.ENTITA IN ('2','3','1001')` — values come from config, not user input. */
export function trackedRepartiSql(column: string): string {
    return repartiInSql(column, TRACKED_REPARTI);
}

/** SQL fragment restricted to the categories the prefill formulas apply to. */
export function prefillRepartiSql(column: string): string {
    return repartiInSql(column, PREFILL_REPARTI);
}

function repartiInSql(column: string, reparti: readonly string[]): string {
    return `${column} IN (${reparti.map((r) => `'${r.replace(/'/g, "''")}'`).join(', ')})`;
}
