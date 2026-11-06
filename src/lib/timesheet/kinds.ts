/**
 * What each kind of line is: written as times or as hours, which column of the day it fills, whether it counts
 * towards the hours a day must cover, and which quick texts its causale is picked from.
 * A new kind is one line here, its name in ENTRY_KINDS (types.ts) and its label in it.ts → timesheet.kinds.
 */

import type { PresenceRulesConfig } from '@/lib/presence';
import { APP_COPY } from '@/locales';
import { ENTRY_KINDS, type EntryKind, type HourField } from './types';

export interface KindSpec {
    /** A span of times (work) or a number of hours */
    input: 'times' | 'hours';
    /** Offered to a person on their own page (Le mie ore); the other kinds are written from Ore Ufficio (the owner) */
    self: boolean;
    /** Always the whole workday (ferie, malattia): no hours to pick, and saving one replaces every other line of its day */
    wholeDay: boolean;
    /** The column of the day its hours go to */
    field: HourField;
    /** Counts towards the hours a day must cover (the extras, straordinarie and banca ore, do not) */
    covers: boolean;
    /** The quick texts of Regole Presenze its causale is picked from; null = no causale */
    presets: 'feriePresets' | 'permessoPresets' | null;
}

export const KIND_SPECS: Record<EntryKind, KindSpec> = {
    work: { input: 'times', field: 'ordinarie', covers: true, presets: null, self: true, wholeDay: false },
    permesso: { input: 'hours', field: 'permesso', covers: true, presets: 'permessoPresets', self: true, wholeDay: false },
    ferie: { input: 'hours', field: 'ferie', covers: true, presets: 'feriePresets', self: true, wholeDay: true },
    malattia: { input: 'hours', field: 'malattia', covers: true, presets: null, self: true, wholeDay: true },
    straordinarie: { input: 'hours', field: 'straordinarie', covers: false, presets: null, self: false, wholeDay: false },
    banca_ore: { input: 'hours', field: 'bancaOre', covers: false, presets: null, self: false, wholeDay: false },
};

/** The quick texts a kind's causale is picked from ([] when it has no causale) */
export function causaleOptions(kind: EntryKind, rules: Pick<PresenceRulesConfig, 'feriePresets' | 'permessoPresets'>): string[] {
    const presets = KIND_SPECS[kind].presets;
    return presets ? rules[presets] : [];
}

/** The causale a whole-day kind starts with: the quick text named like the kind ("Ferie" → FERIE), else the first one */
export function causaleDefault(kind: EntryKind, rules: Pick<PresenceRulesConfig, 'feriePresets' | 'permessoPresets'>): string {
    const options = causaleOptions(kind, rules);
    const label = APP_COPY.timesheet.kinds[kind].toLowerCase();
    return options.find((option) => option.toLowerCase() === label) ?? options[0] ?? '';
}

/** The kinds a person picks for themselves (owner, 2026-11-05: straordinarie and banca ore stay the owner's) */
export const SELF_KINDS: readonly EntryKind[] = ENTRY_KINDS.filter((kind) => KIND_SPECS[kind].self);

/** The columns that count towards the hours a day must cover */
export const COVERING_FIELDS: readonly HourField[] = Object.values(KIND_SPECS)
    .filter((spec) => spec.covers)
    .map((spec) => spec.field);
