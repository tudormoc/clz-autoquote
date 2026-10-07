'use server'

/** Presence settings (VALORI_TABELLE, PRESENZE) and their text presets. */

import { queryMSSQL } from '@/lib/mssql';
import type { PresenceSettingRow } from '@/types';
import {
    PRESENCE_SETTINGS,
} from '@/lib/presence';

/**
 * Rename a preset in NETPRO.VALORI_TABELLE and cascade the update to any existing rows in CLZDWHQANDPROG
 */
export async function renamePresencePresetAction(
    parametro: 'FERIE_PRESETS' | 'PERMESSO_PRESETS',
    oldTag: string,
    newTag: string,
    updatedPresetsValue: string
) {
    try {
        const defaultDesc = PRESENCE_SETTINGS.find((s) => s.key === parametro)?.description;

        // 1. Update presets string in NETPRO.VALORI_TABELLE
        await updatePresenceSettingAction(parametro, updatedPresetsValue, defaultDesc);

        // 2. Cascade update to all employee rows in CLZDWHQANDPROG (tags live in the causale_* columns)
        const col = parametro === 'FERIE_PRESETS' ? 'causale_ferie' : 'causale_permesso';
        const cascadeQuery = `
            UPDATE presence_hours_distribution
            SET ${col} = @newTag, updated_at = SYSDATETIME()
            WHERE ${col} = @oldTag
        `;

        await queryMSSQL(cascadeQuery, { oldTag, newTag }, 'QUOTES');

        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message as string };
    }
}

/**
 * Get all presence configuration parameters from NETPRO.VALORI_TABELLE.
 * Known parameters missing from the DB are returned with their default value so
 * they can be edited (the first save creates the row). Ordered as PRESENCE_SETTINGS.
 */
export async function getAllPresenceSettingsAction() {
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
    } catch (err: any) {
        return {
            success: false,
            error: err.message as string,
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
    try {
        const numericVal = parseFloat(valore);
        const fvalue = isNaN(numericVal) ? null : numericVal;

        const upsertQuery = `
            IF EXISTS (SELECT 1 FROM VALORI_TABELLE WHERE TABELLA = 'PRESENZE' AND PARAMETRO = @parametro)
            BEGIN
                UPDATE VALORI_TABELLE
                SET VALORE = @valore,
                    DESCRIZIONE = ISNULL(@descrizione, DESCRIZIONE),
                    FVALUE01 = @fvalue
                WHERE TABELLA = 'PRESENZE' AND PARAMETRO = @parametro;
            END
            ELSE
            BEGIN
                INSERT INTO VALORI_TABELLE (TABELLA, PARAMETRO, ATTRIBUTO, DESCRIZIONE, VALORE, FVALUE01)
                VALUES ('PRESENZE', @parametro, NULL, @descrizione, @valore, @fvalue);
            END
        `;

        await queryMSSQL(
            upsertQuery,
            {
                parametro,
                valore,
                descrizione: descrizione || null,
                fvalue,
            },
            'NETPRO'
        );

        return {
            success: true,
        };
    } catch (err: any) {
        return {
            success: false,
            error: err.message as string,
        };
    }
}
