import type { OperatorHoursRow, HoursDistributionField } from '@/types';

// PRESENCE RULES — TYPES
// Every formula in src/lib/presence/formulas/* reads its numbers from a
// PresenceRulesConfig. Nothing is hardcoded inside the formulas, so changing
// a rule means changing a value (DB VALORI_TABELLE / PRESENZE, or the
// defaults in src/config/constants.ts → PRESENCE_RULES), not code.

/** Numeric hour fields that can be written by prefill / edit side effects. */
export type HourField = Extract<
    HoursDistributionField,
    'ore_ordinarie' | 'ore_straordinarie' | 'ore_ferie' | 'ore_permesso' | 'ore_malattia' | 'banca_ore'
>;

export type RoundingMode = 'floor' | 'nearest' | 'ceil';

export interface RoundingRule {
    /** Granularity in hours (0.5 = half hours, 1 = whole hours, 0 = no rounding). */
    step: number;
    mode: RoundingMode;
}

export interface PresenceRulesConfig {
    // --- Shift inference from first clock-in ---
    /** Possible shift starts, "HH:MM", ascending. */
    shiftStarts: string[];
    /** Clock-in this many minutes (or less) before a shift start counts from that start. */
    shiftSnapWindowMinutes: number;
    /** Otherwise the clock-in is rounded UP to this step. */
    entryRoundingMinutes: number;
    /** Last clock-out is rounded DOWN to this step. */
    exitRoundingMinutes: number;
    /** Clock-in up to this many minutes after a shift start still counts from the shift start. */
    entryGraceMinutes: number;
    /** Max shortfall (minutes) that real clocked minutes may compensate; 0 disables. */
    compensationToleranceMinutes: number;
    /** Real clocked minutes may miss the workday by this much and still compensate. */
    realMinutesTolerance: number;

    // --- Worked hours ---
    /** Flat break deducted from (counted end − counted start) when the span covers the pause window. */
    pauseMinutes: number;
    /** Pause window "HH:MM"; the pause is deducted only if countedStart ≤ start and countedEnd ≥ end. */
    pauseWindowStart: string;
    pauseWindowEnd: string;

    // --- Day kinds ---
    /** ISO weekdays (1 = Mon … 7 = Sun) with the full working-day rules. */
    workingDays: number[];
    /** ISO weekdays with the extra-day rules (e.g. Saturday). Any other day is off. */
    extraDays: number[];

    // --- Workday ---
    /** Hours a full workday must cover (the "8h rule"). */
    workdayHours: number;

    // --- Extra day ---
    /** Cap for hours counted on an extra day. */
    extraMaxHours: number;
    /** Field that receives the extra-day hours. */
    extraField: HourField;
    /** How extra-day hours are rounded before the cap. */
    extraRounding: RoundingRule;

    // --- Coverage check ---
    /** Fields whose sum must equal workdayHours on a past working day. */
    coveredFields: HourField[];

    // --- Prefill distribution ---
    /** Field that receives workdayHours when the operator did not clock in at all. */
    absenceField: HourField;
    /** Field that receives (workdayHours − ordinarie) on a partial day. */
    partialFillField: HourField;
    /** How ordinarie are rounded on a partial day. */
    ordinarieRounding: RoundingRule;
    /** Field that receives the excess over workdayHours on a full day. */
    overflowField: HourField;
    /** Minimum excess (hours) before anything is written to overflowField. */
    overflowMinHours: number;
    /** How the excess is rounded before being written. */
    overflowRounding: RoundingRule;

    // --- Presets (quick tags) ---
    feriePresets: string[];
    permessoPresets: string[];

    // --- Timesheet (Le mie ore / Ore Ufficio) ---
    /** YYYY-MM-DD: the first day hours are written in the timesheet; earlier days are shown but locked. */
    timesheetStart: string;
    /** "HH:MM": the first and last pick of Dalle / Alle (the company's open hours). */
    timesheetFirstTime: string;
    timesheetLastTime: string;

    // --- Per-operator exceptions (operator code → value). Everyone else uses the base value. ---
    /** Overrides for workdayHours, e.g. a 6h contract. Applies to every formula that reads workdayHours. */
    workdayHoursByOperator: Record<string, number>;
}

/** Subset of a row holding the persisted distribution values. */
export type HoursDistribution = Pick<
    OperatorHoursRow,
    | 'ore_ordinarie'
    | 'ore_straordinarie'
    | 'ore_ferie'
    | 'causale_ferie'
    | 'ore_permesso'
    | 'causale_permesso'
    | 'ore_malattia'
    | 'banca_ore'
>;

/** Kind of calendar day, resolved from the rules (workingDays / extraDays). */
export type DayKind = 'working' | 'extra' | 'off';

/** Which formulas apply to an employee category (see PRESENCE_RULES.CATEGORIES). */
export type CategoryProfile = 'standard' | 'fixed' | 'none';

export type DistributionCategory = 'absence' | 'partial' | 'full' | 'fixed' | 'extra';

/** What prefill proposes to write for one operator-day. */
export interface DistributionProposal {
    category: DistributionCategory;
    values: Partial<Record<HourField, number>>;
}

/**
 * Outcome of the coverage check for one row.
 * kind:  non-working = off day, or extra day with no records → informational only
 *        future      = today or later → informational only
 *        ok          = covered as expected
 *        mismatch    = working day covered ≠ workdayHours (anomaly)
 *        empty       = working day with nothing, or extra day with records but no hours (anomaly)
 */
export interface DayStatus {
    kind: 'non-working' | 'future' | 'ok' | 'mismatch' | 'empty';
    dayKind: DayKind;
    covered: number;
}

/** Raw clock data for one operator-day, as aggregated from SITUAZIONI. */
export interface ClockDay {
    /** First clock-in / last clock-out, "HH:MM" or "HH:MM:SS". */
    firstEntry: string | null | undefined;
    lastExit: string | null | undefined;
    /** Number of clocked sessions (entry→exit pairs). */
    sessions?: number;
    /** Σ minutes of all clocked sessions (real presence, excluding clocked gaps). */
    sessionMinutes?: number | null;
}

/** Result of applying the entry/exit rules to one operator-day. */
export interface CountedDay {
    /** Shift start the clock-in was matched to ("HH:MM"), or null when counted from the rounded clock-in. */
    shiftStart: string | null;
    /** Counted start/end after rounding ("HH:MM"); null when no clock-in / clock-out. */
    countedStart: string | null;
    countedEnd: string | null;
    /** (countedEnd − countedStart − pause) in hours, 2 decimals, never negative. */
    workedHours: number;
    /** True when a minor shortfall was forgiven because the real minutes reached the workday. */
    compensated: boolean;
}
