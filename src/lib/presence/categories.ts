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
    /** What the names of its operators end with in NetPro (" *lb"), null when nothing */
    nameMark: string | null;
    /** The stato fisico a new operator of the category starts with ("OUT", or "OFF" for the office) */
    newStato: string;
    /** Its people enter their own hours in the timesheet (Le mie ore, Ore Ufficio) instead of clocking in NetPro */
    timesheet: boolean;
}

/** Known categories, in display order (without "Altro"). */
export const EMPLOYEE_CATEGORIES: readonly EmployeeCategory[] = PRESENCE_RULES.CATEGORIES.map((c) => ({
    key: c.reparto,
    label: c.label,
    defaultActive: c.defaultActive,
    profile: c.profile,
    nameMark: c.nameMark,
    newStato: c.newStato,
    timesheet: c.timesheet,
}));

export const OTHER_CATEGORY: EmployeeCategory = {
    key: OTHER_CATEGORY_KEY,
    label: PRESENCE_RULES.OTHER_CATEGORY_LABEL,
    defaultActive: false,
    profile: 'none',
    nameMark: null,
    newStato: 'OFF',
    timesheet: false,
};

/** The category of the people who left (NetPro's 999): offered by "Modifica operatore", shown in Operatori only with its own chip */
export const LEFT_CATEGORY = PRESENCE_RULES.LEFT_CATEGORY;

/** Whether a raw ENTITA value is the category of the people who left */
export const isLeftCategory = (reparto: string | null | undefined): boolean => (reparto ?? '').trim() === LEFT_CATEGORY.reparto;

/** ENTITA values of the people who enter their own hours in the timesheet */
const TIMESHEET_REPARTI: readonly string[] = EMPLOYEE_CATEGORIES.filter((c) => c.timesheet).map((c) => c.key);

/** ENTITA values that belong to the presence system (used to list operators and to prefill). */
export const TRACKED_REPARTI: readonly string[] = EMPLOYEE_CATEGORIES.map((c) => c.key);

/** Categories the prefill applies to (profile ≠ 'none'). */
export const PREFILL_CATEGORIES: readonly EmployeeCategory[] = EMPLOYEE_CATEGORIES.filter((c) => c.profile !== 'none');

/** ENTITA values the prefill applies to. */
const PREFILL_REPARTI: readonly string[] = PREFILL_CATEGORIES.map((c) => c.key);

/** Rule profile for a raw ENTITA value ('none' when unknown). */
export function profileFromReparto(reparto: string | null | undefined): CategoryProfile {
    const key = normalizeReparto(reparto);
    return EMPLOYEE_CATEGORIES.find((c) => c.key === key)?.profile ?? 'none';
}

export const DEFAULT_ACTIVE_CATEGORY_KEYS: readonly string[] = EMPLOYEE_CATEGORIES
    .filter((c) => c.defaultActive)
    .map((c) => c.key);

/** Every mark a name may end with, without its leading space */
const NAME_MARKS = EMPLOYEE_CATEGORIES.flatMap((c) => (c.nameMark ? [c.nameMark.trim()] : []));

/** Whether a name ends with the mark of a category ("rossi mario *lb") */
export function hasNameMark(name: string): boolean {
    const lower = name.trim().toLowerCase();
    return NAME_MARKS.some((mark) => lower.endsWith(mark.toLowerCase()));
}

/** The name without any category mark at its end ("rossi mario *lb" → "rossi mario"), trimmed */
export function bareName(name: string): string {
    let clean = name.trim();
    for (const mark of NAME_MARKS) {
        if (clean.toLowerCase().endsWith(mark.toLowerCase())) clean = clean.slice(0, -mark.length).trim();
    }
    return clean;
}

/**
 * The name as NetPro's habit writes it for the category: any category mark taken off the end, then the category's
 * own mark added when it has one ("rossi mario", Interinali → "rossi mario *lb"; back to Produzione → "rossi mario").
 * Who leaves (OFF HR) keeps the name as it was, mark included: NetPro's habit.
 */
export function nameForCategory(name: string, reparto: string | null | undefined): string {
    if (isLeftCategory(reparto)) return name.trim();
    const clean = bareName(name);
    const mark = categoryOf(reparto).nameMark;
    return mark && clean ? `${clean}${mark}` : clean;
}

/** The category of a raw ENTITA value ("Altro" when unknown) */
export function categoryOf(reparto: string | null | undefined): EmployeeCategory {
    const key = normalizeReparto(reparto);
    return EMPLOYEE_CATEGORIES.find((c) => c.key === key) ?? OTHER_CATEGORY;
}

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

/** SQL fragment restricted to the categories whose people use the timesheet. */
export function timesheetRepartiSql(column: string): string {
    return repartiInSql(column, TIMESHEET_REPARTI);
}

function repartiInSql(column: string, reparti: readonly string[]): string {
    return `${column} IN (${reparti.map((r) => `'${r.replace(/'/g, "''")}'`).join(', ')})`;
}
