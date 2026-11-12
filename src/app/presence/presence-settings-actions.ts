'use server'

/** Presence settings (VALORI_TABELLE, PRESENZE) and their text presets. */

import { z } from 'zod';
import { APP_CONFIG } from '@/config/constants';
import { APP_COPY, fmt } from '@/locales';
import { errorMessage } from '@/lib/utils';
import { queryMSSQL, withTransactions } from '@/lib/mssql';
import { readSettingValues, saveSettingValue } from '@/lib/settingsStore';
import { renameCausale } from '@/lib/timesheet/db/entries';
import { KIND_SPECS } from '@/lib/timesheet/kinds';
import { ENTRY_KINDS } from '@/lib/timesheet/types';
import type { PresenceSettingRow } from '@/types';
import {
    PRESENCE_SETTINGS,
} from '@/lib/presence';
import { authorize } from '@/lib/auth/access';
import { LINKS } from '@/config/navigation';
import { logEvent, personOf } from '@/lib/log/log';

/** The lines this file writes in the log (Registro) */
const log = APP_COPY.log.entries;

/** The two lists of quick texts: the hours column of Calcolo Ore Mensile and the timesheet kinds that carry their texts */
const PRESET_LISTS = {
    FERIE_PRESETS: { column: 'causale_ferie', presets: 'feriePresets' },
    PERMESSO_PRESETS: { column: 'causale_permesso', presets: 'permessoPresets' },
} as const;

/** A quick text: as long as a line of the timesheet can hold */
const TagSchema = z.string().trim().min(1).max(APP_CONFIG.TIMESHEET.MAX_CAUSALE_LENGTH);
const RenameSchema = z.object({
    parametro: z.enum(['FERIE_PRESETS', 'PERMESSO_PRESETS']),
    oldTag: TagSchema,
    newTag: TagSchema,
    /** The whole list with the text renamed, as it is stored */
    value: z.string().min(1),
});

/**
 * Renames a quick text of Ferie or Permessi everywhere it is: the list (NETPRO.VALORI_TABELLE), the hours of Calcolo
 * Ore Mensile entered with it (presence_hours_distribution) and the lines of Le mie ore that carry it
 * (timesheet_entries, each with its timesheet_log line; owner, 2026-11-12). One transaction per database: all of it
 * lands, or none. Until 2026-11-12 the list and the hours were two separate writes, the answer of the first was not
 * looked at, and the lines of Le mie ore kept the old text.
 */
export async function renamePresencePresetAction(
    parametro: 'FERIE_PRESETS' | 'PERMESSO_PRESETS',
    oldTag: string,
    newTag: string,
    updatedPresetsValue: string
) {
    const access = await authorize('edit', LINKS.settings['presence']);
    const parsed = RenameSchema.safeParse({ parametro, oldTag, newTag, value: updatedPresetsValue });
    if (!parsed.success) return { success: false, error: APP_COPY.common.invalidData };
    const input = parsed.data;
    const list = PRESET_LISTS[input.parametro];
    try {
        const description = PRESENCE_SETTINGS.find((s) => s.key === input.parametro)?.description;
        const before = (await readSettingValues('PRESENZE')).get(input.parametro) ?? null;
        const kinds = ENTRY_KINDS.filter((kind) => KIND_SPECS[kind].presets === list.presets);
        const tags = { oldTag: input.oldTag, newTag: input.newTag };

        const changed = await withTransactions(['NETPRO', 'QUOTES'], async (run) => {
            await saveSettingValue('PRESENZE', input.parametro, input.value, description, run);
            const hours = await run<{ changed: number }>(
                `UPDATE presence_hours_distribution SET ${list.column} = @newTag, updated_at = SYSDATETIME() WHERE ${list.column} = @oldTag;
                 SELECT @@ROWCOUNT AS changed;`,
                tags,
                'QUOTES'
            );
            const lines = await renameCausale(run, access, kinds, input.oldTag, input.newTag);
            return { hours: hours.recordset[0]?.changed ?? 0, lines };
        });

        await logEvent(personOf(access), {
            page: LINKS.settings['presence'],
            action: 'renamed',
            entityKind: 'presence-preset',
            entityId: input.parametro,
            summary: fmt(log.presetRenamed, { from: input.oldTag, name: input.newTag, ...changed }),
            details: { before: { tag: input.oldTag, list: before }, after: { tag: input.newTag, list: input.value }, rows: changed },
        });
        return { success: true };
    } catch (err) {
        return { success: false, error: errorMessage(err) };
    }
}

/**
 * Get all presence configuration parameters from NETPRO.VALORI_TABELLE.
 * Known parameters missing from the DB are returned with their default value so
 * they can be edited (the first save creates the row). Ordered as PRESENCE_SETTINGS.
 */
export async function getAllPresenceSettingsAction() {
    await authorize('view', LINKS.settings['presence']);
    try {
        const query = `
            SELECT TABELLA, PARAMETRO, VALORE, DESCRIZIONE, FVALUE01
            FROM VALORI_TABELLE WITH (NOLOCK)
            WHERE TABELLA = 'PRESENZE'
        `;
        const result = await queryMSSQL<PresenceSettingRow>(query, {}, 'NETPRO');
        const byKey = new Map(result.recordset.map((r) => [r.PARAMETRO, r] as const));

        const known: PresenceSettingRow[] = PRESENCE_SETTINGS.map((def) => {
            const row = byKey.get(def.key);
            byKey.delete(def.key);
            return row
                ? { ...row, DESCRIZIONE: row.DESCRIZIONE || def.description }
                : { TABELLA: 'PRESENZE', PARAMETRO: def.key, VALORE: def.defaultValue, DESCRIZIONE: def.description, FVALUE01: null };
        });
        const unknown = Array.from(byKey.values()).sort((a, b) => a.PARAMETRO.localeCompare(b.PARAMETRO));

        return {
            success: true,
            data: [...known, ...unknown],
        };
    } catch (err) {
        return {
            success: false,
            error: errorMessage(err),
            data: [] as PresenceSettingRow[],
        };
    }
}

/**
 * Update or Insert a presence configuration parameter in NETPRO.VALORI_TABELLE
 */
export async function updatePresenceSettingAction(
    parametro: string,
    valore: string,
    descrizione?: string
) {
    const access = await authorize('edit', LINKS.settings['presence']);
    try {
        const before = (await readSettingValues('PRESENZE')).get(parametro) ?? null;
        await saveSettingValue('PRESENZE', parametro, valore, descrizione);
        await logEvent(personOf(access), {
            page: LINKS.settings['presence'],
            action: 'changed',
            entityKind: 'presence-setting',
            entityId: parametro,
            summary: fmt(log.presenceSetting, { name: parametro, from: before ?? '-', value: valore }),
            details: { before: { [parametro]: before }, after: { [parametro]: valore } },
        });
        return {
            success: true,
        };
    } catch (err) {
        return {
            success: false,
            error: errorMessage(err),
        };
    }
}
