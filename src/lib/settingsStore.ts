/**
 * Settings the app keeps in NETPRO.VALORI_TABELLE: one row per group (TABELLA) and name (PARAMETRO), the value as text
 * in VALORE and, when it is a number, also in FVALUE01. Presence rules use TABELLA 'PRESENZE', the labour rates of the
 * analytics reports 'ANALISI'. A setting without a row uses its default from the code; the first save creates the row.
 * Server only (used by server actions).
 */

import { queryMSSQL } from '@/lib/mssql';

export type SettingsGroup = 'PRESENZE' | 'ANALISI';

/** Stored values of a group, by name */
export async function readSettingValues(group: SettingsGroup): Promise<Map<string, string>> {
    const result = await queryMSSQL<{ PARAMETRO: string; VALORE: string | null }>(
        `SELECT PARAMETRO, VALORE FROM VALORI_TABELLE WITH (NOLOCK) WHERE TABELLA = @tabella`,
        { tabella: group },
        'NETPRO'
    );
    return new Map(result.recordset.map((row) => [row.PARAMETRO, row.VALORE ?? '']));
}

/** Saves one value: updates its row, or adds it when the setting was never stored */
export async function saveSettingValue(group: SettingsGroup, name: string, value: string, description?: string): Promise<void> {
    const number = parseFloat(value);
    await queryMSSQL(
        `
            IF EXISTS (SELECT 1 FROM VALORI_TABELLE WHERE TABELLA = @tabella AND PARAMETRO = @parametro)
            BEGIN
                UPDATE VALORI_TABELLE
                SET VALORE = @valore,
                    DESCRIZIONE = ISNULL(@descrizione, DESCRIZIONE),
                    FVALUE01 = @fvalue
                WHERE TABELLA = @tabella AND PARAMETRO = @parametro;
            END
            ELSE
            BEGIN
                INSERT INTO VALORI_TABELLE (TABELLA, PARAMETRO, ATTRIBUTO, DESCRIZIONE, VALORE, FVALUE01)
                VALUES (@tabella, @parametro, NULL, @descrizione, @valore, @fvalue);
            END
        `,
        { tabella: group, parametro: name, valore: value, descrizione: description || null, fvalue: isNaN(number) ? null : number },
        'NETPRO'
    );
}
