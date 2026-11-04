/**
 * What each kind of line is: written as times or as hours, which column of the day it fills, whether it counts
 * towards the hours a day must cover, and which quick texts its causale is picked from.
 * A new kind is one line here, its name in ENTRY_KINDS (types.ts) and its label in it.ts → timesheet.kinds.
 */

import type { PresenceRulesConfig } from '@/lib/presence';
import type { EntryKind, HourField } from './types';

export interface KindSpec {
    /** A span of times (work) or a number of hours */
    input: 'times' | 'hours';
    /** The column of the day its hours go to */
    field: HourField;
    /** Counts towards the hours a day must cover (the extras, straordinarie and banca ore, do not) */
    covers: boolean;
    /** The quick texts of Regole Presenze its causale is picked from; null = no causale */
    presets: 'feriePresets' | 'permessoPresets' | null;
}

export const KIND_SPECS: Record<EntryKind, KindSpec> = {
    work: { input: 'times', field: 'ordinarie', covers: true, presets: null },
    ferie: { input: 'hours', field: 'ferie', covers: true, presets: 'feriePresets' },
    permesso: { input: 'hours', field: 'permesso', covers: true, presets: 'permessoPresets' },
    malattia: { input: 'hours', field: 'malattia', covers: true, presets: null },
    straordinarie: { input: 'hours', field: 'straordinarie', covers: false, presets: null },
    banca_ore: { input: 'hours', field: 'bancaOre', covers: false, presets: null },
};

/** The quick texts a kind's causale is picked from ([] when it has no causale) */
export function causaleOptions(kind: EntryKind, rules: Pick<PresenceRulesConfig, 'feriePresets' | 'permessoPresets'>): string[] {
    const presets = KIND_SPECS[kind].presets;
    return presets ? rules[presets] : [];
}

/** The columns that count towards the hours a day must cover */
export const COVERING_FIELDS: readonly HourField[] = Object.values(KIND_SPECS)
    .filter((spec) => spec.covers)
    .map((spec) => spec.field);
