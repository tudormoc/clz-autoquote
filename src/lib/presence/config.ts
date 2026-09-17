import { PRESENCE_RULES } from '@/config/constants';
import type { PresenceSettingRow } from '@/types';
import type { HourField, PresenceRulesConfig, RoundingMode } from './types';

// ============================================================================
// PRESENCE RULES — CONFIG
// ============================================================================
// Single place that knows how a PresenceRulesConfig is built:
//   defaults (src/config/constants.ts → PRESENCE_RULES)
//   ⟶ overridden by NETPRO.VALORI_TABELLE rows (TABELLA = 'PRESENZE')
//
// To add a new tunable:
//   1. add the default to PRESENCE_RULES
//   2. add the field to PresenceRulesConfig (types.ts)
//   3. add one entry to PRESENCE_SETTINGS below
// The settings page and the parser pick it up automatically.
// ============================================================================

const HOUR_FIELDS: readonly HourField[] = [
    'ore_ordinarie',
    'ore_straordinarie',
    'ore_ferie',
    'ore_permesso',
    'ore_malattia',
    'banca_ore',
];

const ROUNDING_MODES: readonly RoundingMode[] = ['floor', 'nearest', 'ceil'];

export type PresenceSettingKind = 'time' | 'number' | 'list' | 'field' | 'rounding' | 'weekdays' | 'operator-map';

export interface PresenceSettingDefinition {
    /** PARAMETRO value in VALORI_TABELLE. */
    key: string;
    kind: PresenceSettingKind;
    /** Default as stored in VALORE. */
    defaultValue: string;
    /** Shown in the settings page when the DB row has no DESCRIZIONE. */
    description: string;
    /** Display unit in the settings page. */
    unit?: string;
    /** Display order in the settings page. */
    order: number;
}

/** Every DB-tunable parameter, in display order. */
export const PRESENCE_SETTINGS: readonly PresenceSettingDefinition[] = [
    { key: 'TURNI_INIZIO', kind: 'list', defaultValue: PRESENCE_RULES.SHIFT_STARTS.join(','), description: 'Orari di inizio turno possibili (HH:MM, separati da virgola)', order: 1 },
    { key: 'TURNO_FINESTRA_MINUTI', kind: 'number', defaultValue: String(PRESENCE_RULES.SHIFT_SNAP_WINDOW_MINUTES), description: 'Ingresso entro N minuti prima di un inizio turno → conteggio da inizio turno', unit: 'min', order: 2 },
    { key: 'INGRESSO_ARROTONDAMENTO', kind: 'number', defaultValue: String(PRESENCE_RULES.ENTRY_ROUNDING_MINUTES), description: 'Ingresso arrotondato per eccesso a N minuti (penalità)', unit: 'min', order: 3 },
    { key: 'USCITA_ARROTONDAMENTO', kind: 'number', defaultValue: String(PRESENCE_RULES.EXIT_ROUNDING_MINUTES), description: 'Uscita arrotondata per difetto a N minuti (penalità)', unit: 'min', order: 4 },
    { key: 'TOLLERANZA_INGRESSO', kind: 'number', defaultValue: String(PRESENCE_RULES.ENTRY_GRACE_MINUTES), description: 'Ingresso fino a N minuti dopo inizio turno conteggiato da inizio turno (0 = disattivo)', unit: 'min', order: 4.1 },
    { key: 'TOLLERANZA_COMPENSAZIONE', kind: 'number', defaultValue: String(PRESENCE_RULES.COMPENSATION_TOLERANCE_MINUTES), description: 'Mancanza massima compensata se i minuti reali timbrati raggiungono la giornata (0 = disattivo)', unit: 'min', order: 4.2 },
    { key: 'TOLLERANZA_MINUTI_REALI', kind: 'number', defaultValue: String(PRESENCE_RULES.REAL_MINUTES_TOLERANCE), description: 'I minuti reali possono mancare la giornata di N minuti e compensare comunque', unit: 'min', order: 4.3 },
    { key: 'PAUSA_MINUTI', kind: 'number', defaultValue: String(PRESENCE_RULES.PAUSE_MINUTES), description: 'Pausa fissa detratta dal totale giornaliero (solo se presente in tutta la finestra pausa)', unit: 'min', order: 5 },
    { key: 'PAUSA_FINESTRA_INIZIO', kind: 'time', defaultValue: PRESENCE_RULES.PAUSE_WINDOW_START, description: 'Inizio finestra pausa: chi entra dopo non ha la pausa detratta', order: 5.1 },
    { key: 'PAUSA_FINESTRA_FINE', kind: 'time', defaultValue: PRESENCE_RULES.PAUSE_WINDOW_END, description: 'Fine finestra pausa: chi esce prima non ha la pausa detratta', order: 5.2 },
    { key: 'ORE_GIORNATA', kind: 'number', defaultValue: String(PRESENCE_RULES.WORKDAY_HOURS), description: 'Ore che una giornata lavorativa deve coprire (regola 8h)', unit: 'h', order: 6 },
    { key: 'ORE_GIORNATA_OPERATORE', kind: 'operator-map', defaultValue: '', description: 'Eccezioni per operatore: codice=ore, separate da virgola (es. 12345=6). Gli altri usano ORE_GIORNATA', order: 6.1 },
    { key: 'GIORNI_LAVORATIVI', kind: 'weekdays', defaultValue: PRESENCE_RULES.WORKING_DAYS.join(','), description: 'Giorni lavorativi con regole complete (1=Lun … 7=Dom, separati da virgola)', order: 7 },
    { key: 'GIORNI_EXTRA', kind: 'weekdays', defaultValue: PRESENCE_RULES.EXTRA_DAYS.join(','), description: 'Giorni extra, es. sabato: solo se timbrati, ore in straordinario (1=Lun … 7=Dom)', order: 7.1 },
    { key: 'EXTRA_ORE_MAX', kind: 'number', defaultValue: String(PRESENCE_RULES.EXTRA_MAX_HOURS), description: 'Ore massime conteggiate in un giorno extra', unit: 'h', order: 7.2 },
    { key: 'EXTRA_CAMPO', kind: 'field', defaultValue: PRESENCE_RULES.EXTRA_FIELD, description: 'Campo che riceve le ore del giorno extra', order: 7.3 },
    { key: 'EXTRA_ARROTONDAMENTO', kind: 'number', defaultValue: String(PRESENCE_RULES.EXTRA_ROUNDING_STEP), description: 'Passo di arrotondamento ore giorno extra (0 = nessuno)', unit: 'h', order: 7.4 },
    { key: 'EXTRA_ARROTONDAMENTO_MODO', kind: 'rounding', defaultValue: PRESENCE_RULES.EXTRA_ROUNDING_MODE, description: 'Modo di arrotondamento giorno extra: floor | nearest | ceil', order: 7.5 },
    { key: 'CAMPI_COPERTURA', kind: 'list', defaultValue: PRESENCE_RULES.COVERED_FIELDS.join(','), description: 'Campi la cui somma deve coprire la giornata (separati da virgola)', order: 8 },
    { key: 'ASSENZA_CAMPO', kind: 'field', defaultValue: PRESENCE_RULES.ABSENCE_FIELD, description: 'Campo riempito con le ore giornata in caso di assenza totale', order: 9 },
    { key: 'PARZIALE_CAMPO', kind: 'field', defaultValue: PRESENCE_RULES.PARTIAL_FILL_FIELD, description: 'Campo che riceve le ore mancanti in caso di presenza parziale', order: 10 },
    { key: 'ORDINARIE_ARROTONDAMENTO', kind: 'number', defaultValue: String(PRESENCE_RULES.ORDINARIE_ROUNDING_STEP), description: 'Passo di arrotondamento delle ore ordinarie (0 = nessuno)', unit: 'h', order: 11 },
    { key: 'ORDINARIE_ARROTONDAMENTO_MODO', kind: 'rounding', defaultValue: PRESENCE_RULES.ORDINARIE_ROUNDING_MODE, description: 'Modo di arrotondamento ordinarie: floor | nearest | ceil', order: 12 },
    { key: 'ECCEDENZA_CAMPO', kind: 'field', defaultValue: PRESENCE_RULES.OVERFLOW_FIELD, description: 'Campo che riceve le ore eccedenti la giornata', order: 13 },
    { key: 'ECCEDENZA_SOGLIA', kind: 'number', defaultValue: String(PRESENCE_RULES.OVERFLOW_MIN_HOURS), description: 'Eccedenza minima per essere registrata', unit: 'h', order: 14 },
    { key: 'ECCEDENZA_ARROTONDAMENTO', kind: 'number', defaultValue: String(PRESENCE_RULES.OVERFLOW_ROUNDING_STEP), description: 'Passo di arrotondamento eccedenza (0 = nessuno)', unit: 'h', order: 15 },
    { key: 'ECCEDENZA_ARROTONDAMENTO_MODO', kind: 'rounding', defaultValue: PRESENCE_RULES.OVERFLOW_ROUNDING_MODE, description: 'Modo di arrotondamento eccedenza: floor | nearest | ceil', order: 16 },
    { key: 'FERIE_PRESETS', kind: 'list', defaultValue: PRESENCE_RULES.FERIE_PRESETS.join(','), description: 'Opzioni rapide testo per Ore Ferie (separate da virgola)', order: 17 },
    { key: 'PERMESSO_PRESETS', kind: 'list', defaultValue: PRESENCE_RULES.PERMESSO_PRESETS.join(','), description: 'Opzioni rapide testo per Ore Permesso (separate da virgola)', order: 18 },
];

export const PRESENCE_SETTING_KEYS = PRESENCE_SETTINGS.map((s) => s.key);

export function getPresenceSettingDefinition(key: string): PresenceSettingDefinition | undefined {
    return PRESENCE_SETTINGS.find((s) => s.key === key);
}

/** Defaults, fully typed. Used when the DB is unreachable and as the base for overrides. */
export const DEFAULT_PRESENCE_RULES: PresenceRulesConfig = {
    shiftStarts: [...PRESENCE_RULES.SHIFT_STARTS],
    shiftSnapWindowMinutes: PRESENCE_RULES.SHIFT_SNAP_WINDOW_MINUTES,
    entryRoundingMinutes: PRESENCE_RULES.ENTRY_ROUNDING_MINUTES,
    exitRoundingMinutes: PRESENCE_RULES.EXIT_ROUNDING_MINUTES,
    entryGraceMinutes: PRESENCE_RULES.ENTRY_GRACE_MINUTES,
    compensationToleranceMinutes: PRESENCE_RULES.COMPENSATION_TOLERANCE_MINUTES,
    realMinutesTolerance: PRESENCE_RULES.REAL_MINUTES_TOLERANCE,
    pauseMinutes: PRESENCE_RULES.PAUSE_MINUTES,
    pauseWindowStart: PRESENCE_RULES.PAUSE_WINDOW_START,
    pauseWindowEnd: PRESENCE_RULES.PAUSE_WINDOW_END,
    workingDays: [...PRESENCE_RULES.WORKING_DAYS],
    extraDays: [...PRESENCE_RULES.EXTRA_DAYS],
    workdayHours: PRESENCE_RULES.WORKDAY_HOURS,
    extraMaxHours: PRESENCE_RULES.EXTRA_MAX_HOURS,
    extraField: PRESENCE_RULES.EXTRA_FIELD,
    extraRounding: {
        step: PRESENCE_RULES.EXTRA_ROUNDING_STEP,
        mode: PRESENCE_RULES.EXTRA_ROUNDING_MODE,
    },
    coveredFields: [...PRESENCE_RULES.COVERED_FIELDS],
    absenceField: PRESENCE_RULES.ABSENCE_FIELD,
    partialFillField: PRESENCE_RULES.PARTIAL_FILL_FIELD,
    ordinarieRounding: {
        step: PRESENCE_RULES.ORDINARIE_ROUNDING_STEP,
        mode: PRESENCE_RULES.ORDINARIE_ROUNDING_MODE,
    },
    overflowField: PRESENCE_RULES.OVERFLOW_FIELD,
    overflowMinHours: PRESENCE_RULES.OVERFLOW_MIN_HOURS,
    overflowRounding: {
        step: PRESENCE_RULES.OVERFLOW_ROUNDING_STEP,
        mode: PRESENCE_RULES.OVERFLOW_ROUNDING_MODE,
    },
    feriePresets: [...PRESENCE_RULES.FERIE_PRESETS],
    permessoPresets: [...PRESENCE_RULES.PERMESSO_PRESETS],
    workdayHoursByOperator: { ...PRESENCE_RULES.WORKDAY_HOURS_BY_OPERATOR },
};

// ---------------------------------------------------------------------------
// Parsing helpers — each returns the fallback on any invalid input so a bad
// DB value can never break the dashboard.
// ---------------------------------------------------------------------------

type SettingSource = Pick<PresenceSettingRow, 'PARAMETRO' | 'VALORE' | 'FVALUE01'>;

function readNumber(row: SettingSource | undefined, fallback: number): number {
    if (!row) return fallback;
    const n = row.FVALUE01 ?? parseFloat((row.VALORE ?? '').trim());
    return Number.isFinite(n) ? n : fallback;
}

const TIME_RE = /^\d{1,2}:\d{2}(:\d{2})?$/;

function normalizeTime(v: string): string | null {
    const t = v.trim();
    if (!TIME_RE.test(t)) return null;
    const [h, m] = t.split(':');
    return `${h.padStart(2, '0')}:${m}`;
}

function readTime(row: SettingSource | undefined, fallback: string): string {
    return normalizeTime(row?.VALORE ?? '') ?? fallback;
}

/** Sorted, de-duplicated list of "HH:MM" times. */
function readTimeList(row: SettingSource | undefined, fallback: string[]): string[] {
    const parts = readList(row, []).map(normalizeTime).filter((t): t is string => t !== null);
    return parts.length > 0 ? Array.from(new Set(parts)).sort() : fallback;
}

function readList(row: SettingSource | undefined, fallback: string[]): string[] {
    const v = (row?.VALORE ?? '').trim();
    if (!v) return fallback;
    const parts = v.split(',').map((s) => s.trim()).filter(Boolean);
    return parts.length > 0 ? parts : fallback;
}

function readHourField(row: SettingSource | undefined, fallback: HourField): HourField {
    const v = (row?.VALORE ?? '').trim().toLowerCase() as HourField;
    return HOUR_FIELDS.includes(v) ? v : fallback;
}

function readHourFields(row: SettingSource | undefined, fallback: HourField[]): HourField[] {
    const parts = readList(row, fallback).map((s) => s.toLowerCase() as HourField);
    const valid = parts.filter((f) => HOUR_FIELDS.includes(f));
    return valid.length > 0 ? valid : fallback;
}

function readRoundingMode(row: SettingSource | undefined, fallback: RoundingMode): RoundingMode {
    const v = (row?.VALORE ?? '').trim().toLowerCase() as RoundingMode;
    return ROUNDING_MODES.includes(v) ? v : fallback;
}

/** "12345=6, 67890=7.5" → { '12345': 6, '67890': 7.5 }. Invalid pairs are skipped; empty → {}. */
function readOperatorNumberMap(row: SettingSource | undefined, fallback: Record<string, number>): Record<string, number> {
    if (!row) return fallback;
    const out: Record<string, number> = {};
    for (const pair of (row.VALORE ?? '').split(',')) {
        const [code, value] = pair.split('=').map((s) => s.trim());
        const n = parseFloat(value ?? '');
        if (code && Number.isFinite(n) && n > 0) out[code] = n;
    }
    return out;
}

/** `allowEmpty`: an explicitly empty value means "no such days" instead of falling back. */
function readWeekdays(row: SettingSource | undefined, fallback: number[], allowEmpty = false): number[] {
    if (!row) return fallback;
    if (allowEmpty && (row.VALORE ?? '').trim() === '') return [];
    const parts = readList(row, []).map(Number).filter((d) => Number.isInteger(d) && d >= 1 && d <= 7);
    return parts.length > 0 ? Array.from(new Set(parts)).sort() : fallback;
}

/**
 * Build the effective rules from VALORI_TABELLE rows (TABELLA = 'PRESENZE').
 * Missing or invalid rows fall back to DEFAULT_PRESENCE_RULES field by field.
 */
export function parsePresenceRules(rows: readonly SettingSource[]): PresenceRulesConfig {
    const byKey = new Map(rows.map((r) => [r.PARAMETRO, r] as const));
    const d = DEFAULT_PRESENCE_RULES;

    return {
        shiftStarts: readTimeList(byKey.get('TURNI_INIZIO'), d.shiftStarts),
        shiftSnapWindowMinutes: readNumber(byKey.get('TURNO_FINESTRA_MINUTI'), d.shiftSnapWindowMinutes),
        entryRoundingMinutes: readNumber(byKey.get('INGRESSO_ARROTONDAMENTO'), d.entryRoundingMinutes),
        exitRoundingMinutes: readNumber(byKey.get('USCITA_ARROTONDAMENTO'), d.exitRoundingMinutes),
        entryGraceMinutes: readNumber(byKey.get('TOLLERANZA_INGRESSO'), d.entryGraceMinutes),
        compensationToleranceMinutes: readNumber(byKey.get('TOLLERANZA_COMPENSAZIONE'), d.compensationToleranceMinutes),
        realMinutesTolerance: readNumber(byKey.get('TOLLERANZA_MINUTI_REALI'), d.realMinutesTolerance),
        pauseMinutes: readNumber(byKey.get('PAUSA_MINUTI'), d.pauseMinutes),
        pauseWindowStart: readTime(byKey.get('PAUSA_FINESTRA_INIZIO'), d.pauseWindowStart),
        pauseWindowEnd: readTime(byKey.get('PAUSA_FINESTRA_FINE'), d.pauseWindowEnd),
        workingDays: readWeekdays(byKey.get('GIORNI_LAVORATIVI'), d.workingDays),
        extraDays: readWeekdays(byKey.get('GIORNI_EXTRA'), d.extraDays, true),
        workdayHours: readNumber(byKey.get('ORE_GIORNATA'), d.workdayHours),
        extraMaxHours: readNumber(byKey.get('EXTRA_ORE_MAX'), d.extraMaxHours),
        extraField: readHourField(byKey.get('EXTRA_CAMPO'), d.extraField),
        extraRounding: {
            step: readNumber(byKey.get('EXTRA_ARROTONDAMENTO'), d.extraRounding.step),
            mode: readRoundingMode(byKey.get('EXTRA_ARROTONDAMENTO_MODO'), d.extraRounding.mode),
        },
        coveredFields: readHourFields(byKey.get('CAMPI_COPERTURA'), d.coveredFields),
        absenceField: readHourField(byKey.get('ASSENZA_CAMPO'), d.absenceField),
        partialFillField: readHourField(byKey.get('PARZIALE_CAMPO'), d.partialFillField),
        ordinarieRounding: {
            step: readNumber(byKey.get('ORDINARIE_ARROTONDAMENTO'), d.ordinarieRounding.step),
            mode: readRoundingMode(byKey.get('ORDINARIE_ARROTONDAMENTO_MODO'), d.ordinarieRounding.mode),
        },
        overflowField: readHourField(byKey.get('ECCEDENZA_CAMPO'), d.overflowField),
        overflowMinHours: readNumber(byKey.get('ECCEDENZA_SOGLIA'), d.overflowMinHours),
        overflowRounding: {
            step: readNumber(byKey.get('ECCEDENZA_ARROTONDAMENTO'), d.overflowRounding.step),
            mode: readRoundingMode(byKey.get('ECCEDENZA_ARROTONDAMENTO_MODO'), d.overflowRounding.mode),
        },
        feriePresets: readList(byKey.get('FERIE_PRESETS'), d.feriePresets),
        permessoPresets: readList(byKey.get('PERMESSO_PRESETS'), d.permessoPresets),
        workdayHoursByOperator: readOperatorNumberMap(byKey.get('ORE_GIORNATA_OPERATORE'), d.workdayHoursByOperator),
    };
}

/**
 * Effective rules for one operator: base rules with per-operator exceptions applied.
 * Every formula takes the result, so an exception (e.g. 6h contract) flows into
 * prefill, coverage check, badges and edit side effects with no extra code.
 */
export function rulesForOperator(operatore: string, rules: PresenceRulesConfig): PresenceRulesConfig {
    const workdayHours = rules.workdayHoursByOperator[operatore.trim()];
    if (workdayHours === undefined) return rules;
    return { ...rules, workdayHours };
}
