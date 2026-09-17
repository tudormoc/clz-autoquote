import type { CategoryProfile, DayKind, DistributionProposal, PresenceRulesConfig } from './types';
import { computeCountedDay, timeToMinutes } from './formulas/counted-times';
import { distributeDay } from './formulas/distribution';
import { rulesForOperator } from './config';

// ============================================================================
// WORKED EXAMPLES — the agreed reference table
// ============================================================================
// Each row is a real case validated with the business. They document the
// expected behaviour AND run as a regression check:
//
//     npm run presence:examples
//
// When a rule changes, update the expected values here in the same commit.
// Rules assumed: shifts 06:30/07:30/08:30, snap window 30, entry ceil 15,
// exit floor 15, pause 60 only if present across 12:00–13:00, workday 8,
// ordinarie floor 0.5, banca ore ≥ 0.5 floor 0.5.
// Extra day (Saturday): raw span, no pause, max 4h floor 0.5 → ore_straordinarie.
// Fixed profile (office): raw span shown, prefill always 8 ordinarie on working days.
// ============================================================================

export interface PresenceExample {
    /** 'working' (Mon–Fri) unless stated. */
    day?: DayKind;
    /** 'standard' unless stated. */
    profile?: CategoryProfile;
    /** Raw first clock-in / last clock-out ("HH:MM"). */
    in: string;
    out: string;
    /**
     * All clocked sessions when there is more than one (used by the compensation rule).
     * Omitted = single session in→out.
     */
    sessions?: [string, string][];
    /** Expected counted times and worked hours. */
    countedStart: string;
    countedEnd: string;
    worked: number;
    /** Expected prefill result; null = nothing written. */
    expect: DistributionProposal['values'] | null;
    note?: string;
}

export const PRESENCE_EXAMPLES: readonly PresenceExample[] = [
    // --- Shift 06:30 ---
    { in: '06:12', out: '16:34', countedStart: '06:30', countedEnd: '16:30', worked: 9.0, expect: { ore_ordinarie: 8, banca_ore: 1 } },
    { in: '06:12', out: '15:33', countedStart: '06:30', countedEnd: '15:30', worked: 8.0, expect: { ore_ordinarie: 8 } },
    { in: '06:12', out: '15:34', countedStart: '06:30', countedEnd: '15:30', worked: 8.0, expect: { ore_ordinarie: 8 }, note: 'pause 12:02–12:58 ignored (flat 60)' },
    { in: '06:14', out: '16:00', countedStart: '06:30', countedEnd: '16:00', worked: 8.5, expect: { ore_ordinarie: 8, banca_ore: 0.5 } },
    { in: '06:15', out: '16:34', countedStart: '06:30', countedEnd: '16:30', worked: 9.0, expect: { ore_ordinarie: 8, banca_ore: 1 } },
    { in: '06:15', out: '16:33', countedStart: '06:30', countedEnd: '16:30', worked: 9.0, expect: { ore_ordinarie: 8, banca_ore: 1 } },
    { in: '06:17', out: '15:32', countedStart: '06:30', countedEnd: '15:30', worked: 8.0, expect: { ore_ordinarie: 8 } },
    { in: '06:18', out: '15:34', countedStart: '06:30', countedEnd: '15:30', worked: 8.0, expect: { ore_ordinarie: 8 } },
    { in: '06:29', out: '15:46', countedStart: '06:30', countedEnd: '15:45', worked: 8.25, expect: { ore_ordinarie: 8 }, note: '0.25 excess < 0.5 → dropped' },
    { in: '06:31', out: '15:45', countedStart: '06:45', countedEnd: '15:45', worked: 8.0, expect: { ore_ordinarie: 8 }, note: '1 min late → counted from 06:45' },

    // --- Shift 07:30 ---
    { in: '07:00', out: '16:30', countedStart: '07:30', countedEnd: '16:30', worked: 8.0, expect: { ore_ordinarie: 8 }, note: 'exactly 30 min before → snaps to 07:30' },
    { in: '06:59', out: '16:30', countedStart: '07:00', countedEnd: '16:30', worked: 8.5, expect: { ore_ordinarie: 8, banca_ore: 0.5 }, note: '31 min before → ceil 15 → 07:00' },
    { in: '07:10', out: '17:10', countedStart: '07:30', countedEnd: '17:00', worked: 8.5, expect: { ore_ordinarie: 8, banca_ore: 0.5 } },
    { in: '07:11', out: '17:39', countedStart: '07:30', countedEnd: '17:30', worked: 9.0, expect: { ore_ordinarie: 8, banca_ore: 1 } },
    { in: '07:16', out: '16:37', countedStart: '07:30', countedEnd: '16:30', worked: 8.0, expect: { ore_ordinarie: 8 } },
    { in: '07:18', out: '16:31', countedStart: '07:30', countedEnd: '16:30', worked: 8.0, expect: { ore_ordinarie: 8 } },
    { in: '07:19', out: '16:34', countedStart: '07:30', countedEnd: '16:30', worked: 8.0, expect: { ore_ordinarie: 8 } },
    { in: '07:21', out: '16:44', countedStart: '07:30', countedEnd: '16:30', worked: 8.0, expect: { ore_ordinarie: 8 } },
    { in: '07:22', out: '16:39', countedStart: '07:30', countedEnd: '16:30', worked: 8.0, expect: { ore_ordinarie: 8 } },
    { in: '07:23', out: '16:36', countedStart: '07:30', countedEnd: '16:30', worked: 8.0, expect: { ore_ordinarie: 8 } },
    { in: '07:24', out: '17:31', countedStart: '07:30', countedEnd: '17:30', worked: 9.0, expect: { ore_ordinarie: 8, banca_ore: 1 } },
    { in: '07:24', out: '16:33', countedStart: '07:30', countedEnd: '16:30', worked: 8.0, expect: { ore_ordinarie: 8 } },
    { in: '07:25', out: '16:45', countedStart: '07:30', countedEnd: '16:45', worked: 8.25, expect: { ore_ordinarie: 8 } },
    { in: '07:25', out: '16:58', countedStart: '07:30', countedEnd: '16:45', worked: 8.25, expect: { ore_ordinarie: 8 } },
    { in: '07:31', out: '16:30', countedStart: '07:45', countedEnd: '16:30', worked: 8.0, expect: { ore_ordinarie: 8 }, note: '1 min late: penalised 7:45 but real 7:59 within tolerance → 8' },
    { in: '07:40', out: '16:30', countedStart: '07:45', countedEnd: '16:30', worked: 7.75, expect: { ore_ordinarie: 7.5, ore_permesso: 0.5 }, note: '10 min late, real 7:50 → partial: ordinarie floor 0.5, permesso fills' },
    { in: '07:46', out: '16:30', countedStart: '08:00', countedEnd: '16:30', worked: 7.5, expect: { ore_ordinarie: 7.5, ore_permesso: 0.5 } },

    // --- Compensation: minor penalty forgiven when real clocked minutes reach 8h ---
    { in: '07:32', out: '16:33', sessions: [['07:32', '12:06'], ['12:58', '16:33']], countedStart: '07:45', countedEnd: '16:30', worked: 8.0, expect: { ore_ordinarie: 8 }, note: 'penalised 7:45 but real 8:09 → granted 8' },
    { in: '07:32', out: '16:20', sessions: [['07:32', '12:06'], ['12:58', '16:20']], countedStart: '07:45', countedEnd: '16:15', worked: 8.0, expect: { ore_ordinarie: 8 }, note: 'real 7:56 ≥ 7:55 (5 min tolerance) → granted 8' },
    { in: '07:32', out: '16:14', sessions: [['07:32', '12:06'], ['12:58', '16:14']], countedStart: '07:45', countedEnd: '16:00', worked: 7.25, expect: { ore_ordinarie: 7, ore_permesso: 1 }, note: 'real 7:50 < 7:55 → not compensated' },
    { in: '06:35', out: '15:35', sessions: [['06:35', '12:00'], ['13:00', '15:35']], countedStart: '06:45', countedEnd: '15:30', worked: 8.0, expect: { ore_ordinarie: 8 }, note: 'real 8:00 exactly → granted 8' },
    { in: '06:35', out: '15:33', sessions: [['06:35', '12:00'], ['13:00', '15:33']], countedStart: '06:45', countedEnd: '15:30', worked: 8.0, expect: { ore_ordinarie: 8 }, note: 'real 7:58 within 5 min tolerance → granted 8' },
    { in: '06:35', out: '15:29', sessions: [['06:35', '12:00'], ['13:00', '15:29']], countedStart: '06:45', countedEnd: '15:15', worked: 7.5, expect: { ore_ordinarie: 7.5, ore_permesso: 0.5 }, note: 'real 7:54 < 7:55 → not compensated' },
    { in: '06:50', out: '15:45', sessions: [['06:50', '12:00'], ['12:40', '15:45']], countedStart: '07:00', countedEnd: '15:45', worked: 8.0, expect: { ore_ordinarie: 8 }, note: 'short pause (40 min) makes up the late entry: real 8:15 → granted 8' },
    { in: '06:50', out: '15:45', sessions: [['06:50', '12:00'], ['13:00', '15:45']], countedStart: '07:00', countedEnd: '15:45', worked: 8.0, expect: { ore_ordinarie: 8 }, note: 'full pause: real 7:55 = tolerance edge → granted 8' },
    { in: '06:50', out: '15:44', sessions: [['06:50', '12:00'], ['13:00', '15:44']], countedStart: '07:00', countedEnd: '15:30', worked: 7.5, expect: { ore_ordinarie: 7.5, ore_permesso: 0.5 }, note: 'real 7:54 → not compensated' },
    { in: '07:31', out: '16:30', countedStart: '07:45', countedEnd: '16:30', worked: 8.0, expect: { ore_ordinarie: 8 }, note: 'single session: pause assumed → real 7:59 within tolerance → granted 8' },
    { in: '07:36', out: '16:30', countedStart: '07:45', countedEnd: '16:30', worked: 7.75, expect: { ore_ordinarie: 7.5, ore_permesso: 0.5 }, note: 'single session: real 7:54 < 7:55 → not compensated' },

    // --- Short day: no pause when the span does not cover the pause window (12:00–13:00) ---
    { in: '07:01', out: '12:10', countedStart: '07:30', countedEnd: '12:00', worked: 4.5, expect: { ore_ordinarie: 4.5, ore_permesso: 3.5 }, note: 'left before lunch → no pause' },
    { in: '07:30', out: '12:00', countedStart: '07:30', countedEnd: '12:00', worked: 4.5, expect: { ore_ordinarie: 4.5, ore_permesso: 3.5 } },
    { in: '07:30', out: '12:59', countedStart: '07:30', countedEnd: '12:45', worked: 5.25, expect: { ore_ordinarie: 5, ore_permesso: 3 }, note: 'ends 12:45 < 13:00 → no pause' },
    { in: '07:30', out: '13:00', countedStart: '07:30', countedEnd: '13:00', worked: 4.5, expect: { ore_ordinarie: 4.5, ore_permesso: 3.5 }, note: 'ends exactly 13:00 → pause deducted' },
    { in: '13:31', out: '17:30', countedStart: '13:45', countedEnd: '17:30', worked: 3.75, expect: { ore_ordinarie: 3.5, ore_permesso: 4.5 }, note: 'afternoon only → no pause' },

    // --- Extra day (Saturday): raw times, no pause, max 4h, always straordinarie ---
    { day: 'extra', in: '06:12', out: '10:20', countedStart: '06:12', countedEnd: '10:20', worked: 4.13, expect: { ore_straordinarie: 4 }, note: '> 4h → capped at 4' },
    { day: 'extra', in: '06:30', out: '12:30', countedStart: '06:30', countedEnd: '12:30', worked: 6.0, expect: { ore_straordinarie: 4 }, note: 'excess dropped, never banca ore' },
    { day: 'extra', in: '07:00', out: '10:54', countedStart: '07:00', countedEnd: '10:54', worked: 3.9, expect: { ore_straordinarie: 3.5 }, note: '3.9 → floor 0.5 → 3.5' },
    { day: 'extra', in: '07:00', out: '11:06', countedStart: '07:00', countedEnd: '11:06', worked: 4.1, expect: { ore_straordinarie: 4 } },
    { day: 'extra', in: '07:00', out: '09:15', countedStart: '07:00', countedEnd: '09:15', worked: 2.25, expect: { ore_straordinarie: 2 } },
    { day: 'extra', in: '07:00', out: '07:12', countedStart: '07:00', countedEnd: '07:12', worked: 0.2, expect: null, note: '< 0.5 after rounding → nothing written' },

    // --- Fixed profile (office): flat 8 ordinarie on working days, raw hours shown, no penalties ---
    { profile: 'fixed', in: '08:47', out: '17:52', countedStart: '08:47', countedEnd: '17:52', worked: 9.08, expect: { ore_ordinarie: 8 }, note: 'no banca ore, no straordinari' },
    { profile: 'fixed', in: '09:10', out: '13:00', countedStart: '09:10', countedEnd: '13:00', worked: 3.83, expect: { ore_ordinarie: 8 }, note: 'short day still 8 — permesso entered by hand' },
    { profile: 'fixed', day: 'extra', in: '08:00', out: '12:30', countedStart: '08:00', countedEnd: '12:30', worked: 4.5, expect: { ore_straordinarie: 4 }, note: 'Saturday rule is the same for every profile' },
];

/** Per-operator exception: ORE_GIORNATA_OPERATORE = "OP6=6" → every formula uses 6 for that operator. */
export const PRESENCE_OPERATOR_EXCEPTION_EXAMPLES: readonly {
    operatore: string; profile: CategoryProfile; day: DayKind; in?: string; out?: string;
    expect: DistributionProposal['values'] | null; note: string;
}[] = [
    { operatore: 'OP6', profile: 'fixed', day: 'working', expect: { ore_ordinarie: 6 }, note: 'office 6h contract, absent → 6 ordinarie' },
    { operatore: 'OP6', profile: 'fixed', day: 'working', in: '09:00', out: '15:00', expect: { ore_ordinarie: 6 }, note: 'office 6h contract, present → 6 ordinarie' },
    { operatore: 'OP6', profile: 'standard', day: 'working', expect: { ore_ferie: 6 }, note: 'standard 6h contract, absent → 6 ferie' },
    { operatore: 'OP6', profile: 'standard', day: 'working', in: '07:30', out: '13:30', expect: { ore_ordinarie: 5, ore_permesso: 1 }, note: '6:00 − 1h pause = 5 ordinarie, permesso fills to 6' },
    { operatore: 'OTHER', profile: 'fixed', day: 'working', expect: { ore_ordinarie: 8 }, note: 'not listed → default 8' },
];

export function runOperatorExceptionExamples(baseRules: PresenceRulesConfig) {
    const rules: PresenceRulesConfig = { ...baseRules, workdayHoursByOperator: { OP6: 6 } };
    return PRESENCE_OPERATOR_EXCEPTION_EXAMPLES.map((example) => {
        const opRules = rulesForOperator(example.operatore, rules);
        const day = computeCountedDay(toClockDay(example.in ?? null, example.out ?? null), opRules, example.day, example.profile);
        const actual = distributeDay(day.workedHours, example.day, opRules, example.profile)?.values ?? null;
        const pass = JSON.stringify(actual && sortKeys(actual)) === JSON.stringify(example.expect && sortKeys(example.expect));
        return { example, actual, pass };
    });
}

/** No clock records at all: the only case not expressible as in/out. */
export const PRESENCE_NO_RECORD_EXAMPLES: readonly { profile: CategoryProfile; day: DayKind; expect: DistributionProposal['values'] | null; note: string }[] = [
    { profile: 'standard', day: 'working', expect: { ore_ferie: 8 }, note: 'absence → ferie' },
    { profile: 'fixed', day: 'working', expect: { ore_ordinarie: 8 }, note: 'office absent → still 8 ordinarie' },
    { profile: 'standard', day: 'extra', expect: null, note: 'Saturday nobody worked → nothing' },
    { profile: 'fixed', day: 'extra', expect: null, note: 'Saturday nobody worked → nothing' },
    { profile: 'none', day: 'working', expect: null, note: 'category not prefilled' },
];

export interface NoRecordExampleResult {
    example: (typeof PRESENCE_NO_RECORD_EXAMPLES)[number];
    actual: DistributionProposal['values'] | null;
    pass: boolean;
}

export function runNoRecordExamples(rules: PresenceRulesConfig): NoRecordExampleResult[] {
    return PRESENCE_NO_RECORD_EXAMPLES.map((example) => {
        const actual = distributeDay(0, example.day, rules, example.profile)?.values ?? null;
        const pass = JSON.stringify(actual && sortKeys(actual)) === JSON.stringify(example.expect && sortKeys(example.expect));
        return { example, actual, pass };
    });
}

export interface ExampleResult {
    example: PresenceExample;
    actual: { countedStart: string | null; countedEnd: string | null; worked: number; values: DistributionProposal['values'] | null };
    pass: boolean;
}

/** Run every example against the given rules. */
export function runPresenceExamples(rules: PresenceRulesConfig): ExampleResult[] {
    return PRESENCE_EXAMPLES.map((example) => {
        const dayKind = example.day ?? 'working';
        const profile = example.profile ?? 'standard';
        const day = computeCountedDay(toClockDay(example.in, example.out, example.sessions), rules, dayKind, profile);
        const proposal = distributeDay(day.workedHours, dayKind, rules, profile);
        const actual = { countedStart: day.countedStart, countedEnd: day.countedEnd, worked: day.workedHours, values: proposal?.values ?? null };
        const pass =
            actual.countedStart === example.countedStart &&
            actual.countedEnd === example.countedEnd &&
            actual.worked === example.worked &&
            JSON.stringify(actual.values && sortKeys(actual.values)) === JSON.stringify(example.expect && sortKeys(example.expect));
        return { example, actual, pass };
    });
}

function toClockDay(firstEntry: string | null, lastExit: string | null, sessions?: [string, string][]) {
    const list = sessions ?? (firstEntry && lastExit ? [[firstEntry, lastExit] as [string, string]] : []);
    const sessionMinutes = list.reduce((sum, [a, b]) => sum + (timeToMinutes(b) - timeToMinutes(a)), 0);
    return { firstEntry, lastExit, sessions: list.length, sessionMinutes: list.length ? sessionMinutes : null };
}

function sortKeys<T extends object>(obj: T): T {
    return Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b))) as T;
}
