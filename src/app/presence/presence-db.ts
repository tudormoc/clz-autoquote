/**
 * Database helpers shared by the presence server actions. Not a 'use server' file on purpose:
 * these must not become actions the browser can call.
 */

import { errorMessage } from '@/lib/utils';
import { queryMSSQL } from '@/lib/mssql';
import type { PresenceSettingRow } from '@/types';
import {
    DEFAULT_PRESENCE_RULES,
    PRESENCE_SETTING_KEYS,
    parsePresenceRules,
    type PresenceRulesConfig,
    type HourField,
} from '@/lib/presence';

/**
 * Helper: Checks if the operator currently has an active production event (EVENTO = 'EXE').
 * If so, inserts two SUS (suspended) events in EVENTI at the exact exit timestamp:
 * 1) TIPO_OGGETTO = 'OPE' (for the operator)
 * 2) TIPO_OGGETTO = 'MAC' (for the machine)
 */
export async function suspendActiveExecutionIfAny(operatorCode: string, exitTimeStr: string) {
    try {
        console.log('=== suspendActiveExecutionIfAny called ===', { operatorCode, exitTimeStr });
        const formattedTime = exitTimeStr.includes('.') ? exitTimeStr : `${exitTimeStr}.000`;
        
        // Find if there's an open task (OPN event without a matching SUS/CLO after it)
        const latestQuery = `
            SELECT TOP 1 
                EVT.TASK, EVT.MACCHINA, EVT.OPERATORE
            FROM EVENTI EVT WITH (NOLOCK)
            WHERE EVT.TASK NOT IN ('presenza', 'stato')
              AND EVT.EVENTO IN ('OPN', 'EXE', 'WORK', 'REW', 'REL')
              AND (EVT.OPERATORE = @operatorCode OR (EVT.OGGETTO = @operatorCode AND EVT.TIPO_OGGETTO = 'OPE'))
              AND NOT EXISTS (
                  -- Check if there's a SUS or CLO event after this OPN
                  SELECT 1 FROM EVENTI E2 WITH (NOLOCK)
                  WHERE E2.TASK = EVT.TASK
                    AND (E2.OPERATORE = @operatorCode OR (E2.OGGETTO = @operatorCode AND E2.TIPO_OGGETTO = 'OPE'))
                    AND E2.EVENTO IN ('SUS', 'CLO')
                    AND E2.ORA_EVENTO > EVT.ORA_EVENTO
              )
            ORDER BY EVT.ORA_EVENTO DESC
        `;

        const result = await queryMSSQL<{ TASK: string; MACCHINA: string | null; OPERATORE: string | null }>(latestQuery, { operatorCode }, 'NETPRO');
        console.log('=== Query result ===', { 
            recordCount: result.recordset?.length, 
            records: result.recordset,
            operatorCode,
            queryUsed: 'Checking for OPN/EXE/WORK without subsequent SUS/CLO'
        });
        
        if (!result.recordset || result.recordset.length === 0) {
            console.log('=== No active task found, returning early ===');
            return;
        }

        const lastEvent = result.recordset[0];
        const task = lastEvent.TASK;
        const machine = lastEvent.MACCHINA;
        const operator = lastEvent.OPERATORE;
        console.log('=== Found task to suspend ===', { task, machine, operator });
        
        // Get the PART_NUMBER from the JOBSET/ORDINI tables for this task
        const partQuery = `
            SELECT TOP 1 O.PART_NUMBER
            FROM JOBSET J WITH (NOLOCK)
            INNER JOIN ORDINI O WITH (NOLOCK) ON J.ORDINE = O.ORDINE
            WHERE J.TASK = @task
        `;
        const partResult = await queryMSSQL<{ PART_NUMBER: string | null }>(partQuery, { task }, 'NETPRO');
        console.log('=== PART_NUMBER query result ===', { recordCount: partResult.recordset?.length, partNumber: partResult.recordset[0]?.PART_NUMBER });
        
        const partNumber = partResult.recordset.length > 0 ? partResult.recordset[0].PART_NUMBER : null;
        const info1 = null;
        const info2 = null;
        const info3 = null;
        console.log('=== About to insert SUS event ===', { task, partNumber, formattedTime });

        // CRITICAL: Create MAC SUS and OPE SUS events on the TASK (like official app)
        // Create MAC SUS first
        if (machine) {
            await queryMSSQL(`
                INSERT INTO EVENTI (
                    TASK, TIPO_OGGETTO, OGGETTO, EVENTO, ORA_EVENTO, 
                    MACCHINA, OPERATORE, PART_NUMBER, SOURCE, UTENTE, INFO1, INFO2, INFO3
                )
                VALUES (
                    @task, 'MAC', @machine, 'SUS', @formattedTime,
                    @machine, @operatorCode, @partNumber, 'WS', 'ADMIN', @info1, @info2, @info3
                )
            `, {
                task,
                machine,
                formattedTime,
                operatorCode,
                partNumber,
                info1,
                info2,
                info3
            }, 'NETPRO');

            // Update MACCHINE table
            await queryMSSQL(`
                UPDATE MACCHINE
                SET STATO_LOGICO = 'IDLE',
                    ORA_ST_LOGICO = @formattedTime
                WHERE MACCHINA = @machine
            `, { machine, formattedTime }, 'NETPRO');
        }

        // Then create OPE SUS
        await queryMSSQL(`
            INSERT INTO EVENTI (
                TASK, TIPO_OGGETTO, OGGETTO, EVENTO, ORA_EVENTO, 
                MACCHINA, OPERATORE, PART_NUMBER, SOURCE, UTENTE, INFO1, INFO2, INFO3
            )
            VALUES (
                @task, 'OPE', @operatorCode, 'SUS', @formattedTime,
                @machine, @operatorCode, @partNumber, 'WS', 'ADMIN', @info1, @info2, @info3
            )
        `, {
            task,
            operatorCode,
            formattedTime,
            machine,
            partNumber,
            info1,
            info2,
            info3
        }, 'NETPRO');

        // Update TASKS and OPERAZIONI to set status to 'SUS'
        if (task) {
            await queryMSSQL(`
                UPDATE TASKS SET STATO = 'SUS' WHERE TASK = @task
            `, { task }, 'NETPRO');
            await queryMSSQL(`
                UPDATE OPERAZIONI SET STATO = 'SUS' WHERE ID_OPER = @task
            `, { task }, 'NETPRO');
        }

        // Update OPERATORI table to set logical state to 'IDLE'
        await queryMSSQL(`
            UPDATE OPERATORI
            SET STATO_LOGICO = 'IDLE',
                ORA_ST_LOGICO = @formattedTime
            WHERE OPERATORE = @operatorCode
        `, { operatorCode, formattedTime }, 'NETPRO');

        console.log('=== MAC SUS and OPE SUS events inserted (no MAC IDLE stato), states updated ===');
    } catch (err) {
        console.error('Error suspending active execution for operator:', operatorCode, err);
        // Re-throw to see the error in the parent function
        throw new Error(`Suspend failed: ${errorMessage(err)}`);
    }
}

/**
 * Load the effective presence rules: defaults overridden by NETPRO.VALORI_TABELLE (PRESENZE).
 * Never throws — falls back to DEFAULT_PRESENCE_RULES if the DB is unreachable.
 */
export async function loadPresenceRules(): Promise<PresenceRulesConfig> {
    try {
        const keys = PRESENCE_SETTING_KEYS.map((k) => `'${k}'`).join(',');
        const res = await queryMSSQL<PresenceSettingRow>(
            `SELECT PARAMETRO, VALORE, FVALUE01
             FROM VALORI_TABELLE WITH (NOLOCK)
             WHERE TABELLA = 'PRESENZE' AND PARAMETRO IN (${keys})`,
            {},
            'NETPRO'
        );
        return parsePresenceRules(res.recordset);
    } catch {
        return DEFAULT_PRESENCE_RULES;
    }
}

/** Build `(a LIKE @p0 OR b LIKE @p0 ...)` conditions for a comma-separated operator search. */
export function buildOperatorSearch(
    operatorFilter: string | undefined,
    columns: string[],
    paramPrefix: string,
    params: Record<string, unknown>
): string | null {
    const terms = (operatorFilter ?? '').split(',').map((o) => o.trim()).filter(Boolean);
    if (terms.length === 0) return null;
    const conds = terms.map((term, i) => {
        params[`${paramPrefix}${i}`] = `%${term}%`;
        return `(${columns.map((c) => `${c} LIKE @${paramPrefix}${i}`).join(' OR ')})`;
    });
    return `(${conds.join(' OR ')})`;
}

export const DISTRIBUTION_SELECT = `
    SELECT
        operatore,
        CONVERT(VARCHAR(10), data, 120) AS data,
        ore_ordinarie,
        ore_straordinarie,
        ore_ferie,
        causale_ferie,
        ore_permesso,
        causale_permesso,
        ore_malattia,
        banca_ore,
        banca_ore_mese_n1,
        banca_ore_mese_n
    FROM presence_hours_distribution WITH (NOLOCK)
    WHERE data >= @dateFrom AND data <= @dateTo
`;

export type DistributionRecord = Partial<Record<HourField | 'causale_ferie' | 'causale_permesso' | 'banca_ore_mese_n1' | 'banca_ore_mese_n', unknown>> & { operatore: string; data: string };

/** Map saved distributions by `operatore_YYYY-MM-DD`. */
export async function loadDistributionMap(dateFrom: string, dateTo: string): Promise<Map<string, DistributionRecord>> {
    const res = await queryMSSQL<DistributionRecord>(DISTRIBUTION_SELECT, { dateFrom, dateTo }, 'QUOTES')
        .catch(() => ({ recordset: [] as DistributionRecord[] }));
    const map = new Map<string, DistributionRecord>();
    for (const d of res.recordset) {
        const dateStr = typeof d.data === 'string' ? d.data.substring(0, 10) : '';
        map.set(`${d.operatore}_${dateStr}`, d);
    }
    return map;
}
