'use server'

import { queryMSSQL } from '@/lib/mssql';
import { APP_CONFIG } from '@/config/constants';

export async function getDailyEventsAction(
    dateFrom: string, 
    dateTo: string, 
    operatorFilter?: string
) {
    try {
        const conditions: string[] = [
            'EVT.TASK = @task',
            'CAST(EVT.ORA_EVENTO AS DATE) >= @dateFrom',
            'CAST(EVT.ORA_EVENTO AS DATE) <= @dateTo'
        ];

        const params: Record<string, any> = {
            task: 'presenza',
            dateFrom,
            dateTo
        };

        // Build operator filter (advanced: searches both code and name for each term)
        if (operatorFilter) {
            const operatorTerms = operatorFilter.split(',').map(o => o.trim()).filter(o => o);
            if (operatorTerms.length > 0) {
                // For each term, search in both code and name
                const termConditions = operatorTerms.map((_, i) => 
                    `(EVT.OGGETTO LIKE @operator${i} OR OPE.NOME LIKE @operator${i})`
                );
                conditions.push(`(${termConditions.join(' OR ')})`);
                operatorTerms.forEach((term, i) => {
                    params[`operator${i}`] = `%${term}%`;
                });
            }
        }

        const whereClause = conditions.join(' AND ');

        const query = `
            SELECT 
                EVT.OGGETTO,
                OPE.NOME as operator_name,
                EVT.EVENTO,
                EVT.ORA_EVENTO
            FROM EVENTI EVT WITH (NOLOCK)
            LEFT JOIN OPERATORI OPE WITH (NOLOCK) ON EVT.OGGETTO = OPE.OPERATORE
            WHERE ${whereClause}
            ORDER BY EVT.ORA_EVENTO ASC
        `;

        const result = await queryMSSQL(query, params, 'NETPRO');

        return {
            success: true,
            data: result.recordset
        };
    } catch (err: any) {
        return {
            success: false,
            error: err.message,
            data: []
        };
    }
}

export async function updateEventAction(
    oggetto: string,
    oraEvento: string,
    columnName: 'EVENTO' | 'ORA_EVENTO',
    newValue: any
) {
    try {
        // For datetime updates, ensure we're storing the exact value without timezone conversion
        let queryValue = newValue;
        if (columnName === 'ORA_EVENTO') {
            // Ensure datetime format and add milliseconds if missing
            queryValue = newValue.includes('.') ? newValue : `${newValue}.000`;
        }

        // Update based on composite key: OGGETTO + ORA_EVENTO
        const query = `
            UPDATE EVENTI
            SET ${columnName} = @newValue
            WHERE OGGETTO = @oggetto
              AND ORA_EVENTO = @oraEvento
              AND TASK = 'presenza'
        `;

        await queryMSSQL(query, {
            newValue: queryValue,
            oggetto,
            oraEvento
        }, 'NETPRO');

        return {
            success: true,
            message: 'Event updated successfully'
        };
    } catch (err: any) {
        return {
            success: false,
            error: err.message
        };
    }
}

export async function getConnectedEventsAction(
    oggetto: string,
    oraEvento: string,
    pairedOraEvento?: string | null
) {
    try {
        const t1 = new Date(oraEvento).getTime();
        const t2 = pairedOraEvento ? new Date(pairedOraEvento).getTime() : t1;
        const startTime = new Date(Math.min(t1, t2)).toISOString().replace('T', ' ').replace('Z', '');
        const endTime = new Date(Math.max(t1, t2)).toISOString().replace('T', ' ').replace('Z', '');
        const dateStr = startTime.slice(0, 10);

        // Fetch all events for this operator or related machine in the timeframe
        const query = `
            SELECT TASK, TIPO_OGGETTO, OGGETTO, EVENTO, ORA_EVENTO
            FROM EVENTI WITH (NOLOCK)
            WHERE (
                OPERATORE = @oggetto 
                OR OGGETTO = @oggetto 
                OR (TIPO_OGGETTO = 'MAC' AND OGGETTO IN (
                    SELECT DISTINCT MACCHINA FROM EVENTI WITH (NOLOCK) 
                    WHERE OPERATORE = @oggetto AND CAST(ORA_EVENTO AS DATE) = @dateStr
                ))
            )
            AND ORA_EVENTO >= @startTime
            AND ORA_EVENTO <= @endTime
            ORDER BY ORA_EVENTO ASC
        `;

        const result = await queryMSSQL(query, { oggetto, startTime, endTime, dateStr }, 'NETPRO');
        return {
            success: true,
            data: result.recordset
        };
    } catch (err: any) {
        return {
            success: false,
            error: err.message,
            data: []
        };
    }
}

export async function deleteEventsAction(
    operatorCode: string,
    eventsToDelete: { task: string; tipoOggetto: string; oggetto: string; evento: string; oraEvento: string }[]
) {
    try {
        if (!eventsToDelete || eventsToDelete.length === 0) {
            return { success: true, message: 'No events to delete' };
        }

        const firstEventTime = eventsToDelete[0].oraEvento;
        const todayStr = new Date(firstEventTime).toISOString().slice(0, 10);

        for (const item of eventsToDelete) {
            const formattedTime = item.oraEvento.includes('.') ? item.oraEvento : `${item.oraEvento}.000`;

            // 1. Delete this specific event log from EVENTI
            await queryMSSQL(`
                DELETE FROM EVENTI
                WHERE TASK = @task
                  AND TIPO_OGGETTO = @tipoOggetto
                  AND OGGETTO = @oggetto
                  AND EVENTO = @evento
                  AND ORA_EVENTO = @formattedTime
            `, {
                task: item.task,
                tipoOggetto: item.tipoOggetto,
                oggetto: item.oggetto,
                evento: item.evento,
                formattedTime
            }, 'NETPRO');

            // 2. If we are deleting a SUS event, restore active task/operation/operator state back to EXE/WORK
            if (item.evento === 'SUS' && item.task !== 'presenza') {
                // Restore Task status
                await queryMSSQL(`
                    UPDATE TASKS
                    SET STATO = 'EXE'
                    WHERE TASK = @task AND STATO = 'SUS'
                `, { task: item.task }, 'NETPRO');

                // Restore Operation status
                await queryMSSQL(`
                    UPDATE OPERAZIONI
                    SET STATO = 'EXE'
                    WHERE ID_OPER = @task AND STATO = 'SUS'
                `, { task: item.task }, 'NETPRO');

                // Restore Operator logical state
                await queryMSSQL(`
                    UPDATE OPERATORI
                    SET STATO_LOGICO = 'WORK'
                    WHERE OPERATORE = @operatorCode AND STATO_LOGICO = 'IDLE'
                `, { operatorCode }, 'NETPRO');
            }

            // 3. If we are deleting a machine IDLE/SUS state, restore MACCHINE state back to WORK
            if ((item.evento === 'IDLE' && item.task === 'stato') || (item.evento === 'SUS' && item.tipoOggetto === 'MAC')) {
                const machineCode = item.tipoOggetto === 'MAC' ? item.oggetto : (item.task === 'stato' ? item.oggetto : null);
                if (machineCode) {
                    await queryMSSQL(`
                        UPDATE MACCHINE
                        SET STATO_LOGICO = 'WORK'
                        WHERE MACCHINA = @machineCode AND STATO_LOGICO = 'IDLE'
                    `, { machineCode }, 'NETPRO');
                }
            }
        }

        // 4. Recalculate latest presence status for operator based on remaining presence events today
        const latestEventQuery = `
            SELECT TOP 1 EVENTO
            FROM EVENTI WITH (NOLOCK)
            WHERE OGGETTO = @operatorCode
              AND TASK = 'presenza'
              AND CAST(ORA_EVENTO AS DATE) = @today
            ORDER BY ORA_EVENTO DESC
        `;
        const latestRes = await queryMSSQL(latestEventQuery, { operatorCode, today: todayStr }, 'NETPRO');
        
        let newStatus = 'OUT';
        if (latestRes.recordset.length > 0) {
            const lastEvt = String(latestRes.recordset[0].EVENTO).trim().toUpperCase();
            newStatus = lastEvt === 'ENT' ? 'IN' : 'OUT';
        }

        await queryMSSQL(
            `UPDATE OPERATORI SET STATO_FISICO = @newStatus WHERE OPERATORE = @operatorCode`,
            { newStatus, operatorCode },
            'NETPRO'
        );

        return {
            success: true,
            message: 'Events deleted and states restored successfully'
        };
    } catch (err: any) {
        return {
            success: false,
            error: err.message
        };
    }
}

/**
 * Helper: Checks if the operator currently has an active production event (EVENTO = 'EXE').
 * If so, inserts two SUS (suspended) events in EVENTI at the exact exit timestamp:
 * 1) TIPO_OGGETTO = 'OPE' (for the operator)
 * 2) TIPO_OGGETTO = 'MAC' (for the machine)
 */
async function suspendActiveExecutionIfAny(operatorCode: string, exitTimeStr: string) {
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

        const result = await queryMSSQL(latestQuery, { operatorCode }, 'NETPRO');
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
        const partResult = await queryMSSQL(partQuery, { task }, 'NETPRO');
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
    } catch (err: any) {
        console.error('Error suspending active execution for operator:', operatorCode, err);
        // Re-throw to see the error in the parent function
        throw new Error(`Suspend failed: ${err.message}`);
    }
}

export async function createEventAction(
    oggetto: string,
    evento: string,
    oraEvento: string
) {
    try {
        const upperEvt = evento.trim().toUpperCase();
        
        // If the event is an exit (EXT), suspend any active machine task BEFORE creating the EXT event
        // Use a timestamp 1 second before the EXT event for the SUS events
        if (upperEvt === 'EXT') {
            // Parse the local time string (format: "YYYY-MM-DD HH:MM:SS")
            // Subtract 1 second directly from the time string to avoid timezone issues
            const timeParts = oraEvento.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
            if (!timeParts) {
                throw new Error(`Invalid time format: ${oraEvento}`);
            }
            
            const [, datePart, hours, minutes, seconds] = timeParts;
            const totalSeconds = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds) - 1;
            const newHours = Math.floor(totalSeconds / 3600);
            const newMinutes = Math.floor((totalSeconds % 3600) / 60);
            const newSeconds = totalSeconds % 60;
            
            const susTimeStr = `${datePart} ${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}:${String(newSeconds).padStart(2, '0')}`;
            console.log('=== EXT timestamp calculation ===', { original: oraEvento, susTime: susTimeStr });
            await suspendActiveExecutionIfAny(oggetto, susTimeStr);
        }

        const query = `
            INSERT INTO EVENTI (OGGETTO, EVENTO, ORA_EVENTO, TASK, TIPO_OGGETTO, SOURCE, UTENTE, OPERATORE)
            VALUES (@oggetto, @evento, @oraEvento, 'presenza', 'OPE', 'WS', 'ADMIN', @oggetto)
        `;

        await queryMSSQL(query, {
            oggetto,
            evento,
            oraEvento: oraEvento.includes('.') ? oraEvento : `${oraEvento}.000`
        }, 'NETPRO');

        // Also update OPERATORI.STATO_FISICO status
        const newStatus = upperEvt === 'EXT' ? 'OUT' : (upperEvt === 'ENT' ? 'IN' : null);
        if (newStatus) {
            await queryMSSQL(
                `UPDATE OPERATORI SET STATO_FISICO = @newStatus, ORA_ST_FISICO = @oraEvento WHERE OPERATORE = @oggetto`,
                { newStatus, oggetto, oraEvento: oraEvento.includes('.') ? oraEvento : `${oraEvento}.000` },
                'NETPRO'
            );
        }

        return {
            success: true,
            message: 'Event created and operator status updated successfully'
        };
    } catch (err: any) {
        return {
            success: false,
            error: err.message
        };
    }
}

export interface OperatorRow {
    OPERATORE: string;
    NOME: string | null;
    BADGE: string | null;
    STATO_FISICO: string | null;
}

export async function getOperatorsAction(search?: string) {
    try {
        const conditions: string[] = [];
        const params: Record<string, string> = {};

        if (search && search.trim()) {
            const terms = search.split(',').map(t => t.trim()).filter(t => t);
            if (terms.length > 0) {
                const termConditions = terms.map((_, i) =>
                    `(OPERATORE LIKE @term${i} OR NOME LIKE @term${i} OR BADGE LIKE @term${i})`
                );
                conditions.push(`(${termConditions.join(' OR ')})`);
                terms.forEach((term, i) => {
                    params[`term${i}`] = `%${term}%`;
                });
            }
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const query = `
            SELECT 
                OPERATORE,
                NOME,
                BADGE,
                STATO_FISICO
            FROM OPERATORI WITH (NOLOCK)
            ${whereClause}
            ORDER BY OPERATORE ASC
        `;

        const result = await queryMSSQL(query, params, 'NETPRO');

        const statiResult = await queryMSSQL(
            `SELECT DISTINCT STATO_FISICO FROM OPERATORI WITH (NOLOCK) WHERE STATO_FISICO IS NOT NULL AND STATO_FISICO <> '' ORDER BY STATO_FISICO ASC`,
            {},
            'NETPRO'
        );

        return {
            success: true,
            data: result.recordset as OperatorRow[],
            allStati: statiResult.recordset.map((r: any) => r.STATO_FISICO as string)
        };
    } catch (err: any) {
        return {
            success: false,
            error: err.message as string,
            data: [] as OperatorRow[],
            allStati: [] as string[]
        };
    }
}

export async function updateOperatorAction(
    operatore: string,
    columnName: 'BADGE' | 'NOME' | 'STATO_FISICO',
    newValue: string | null
) {
    try {
        const query = `
            UPDATE OPERATORI
            SET ${columnName} = @newValue
            WHERE OPERATORE = @operatore
        `;

        await queryMSSQL(query, {
            newValue: newValue ?? null,
            operatore
        }, 'NETPRO');

        return {
            success: true,
            message: 'Operator updated successfully'
        };
    } catch (err: any) {
        return {
            success: false,
            error: err.message as string
        };
    }
}

/**
 * Auto-exit: find all operators with an ENT event today but no EXT event,
 * then create an EXT event at the configured time based on the day of the week.
 * Sunday is always skipped.
 *
 * @param testOperator - Optional: limit to a single operator code (for testing)
 */
export async function runAutoExitAction(testOperator?: string) {
    try {
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

        // Skip Sundays
        if (dayOfWeek === 0) {
            return { success: true, skipped: true, reason: 'Sunday — no auto-exit', processed: 0 };
        }

        // Pick the correct exit time based on day
        const exitTime = dayOfWeek === 6
            ? APP_CONFIG.PRESENCE.AUTO_EXIT_TIME_SATURDAY
            : APP_CONFIG.PRESENCE.AUTO_EXIT_TIME_WEEKDAY;

        // Format today as YYYY-MM-DD for MSSQL date comparison
        const todayStr = now.toISOString().slice(0, 10);

        const params: Record<string, any> = { today: todayStr };
        if (testOperator) params.testOperator = testOperator;

        // Find operators whose LAST presence event today is ENT (handles multiple ENT/EXT pairs)
        const operatorWhere = testOperator ? `AND OGGETTO = @testOperator` : '';
        const findQuery = `
            SELECT OGGETTO
            FROM (
                SELECT OGGETTO, EVENTO,
                       ROW_NUMBER() OVER (PARTITION BY OGGETTO ORDER BY ORA_EVENTO DESC) AS rn
                FROM EVENTI WITH (NOLOCK)
                WHERE TASK = 'presenza'
                  AND CAST(ORA_EVENTO AS DATE) = @today
                  ${operatorWhere}
            ) ranked
            WHERE rn = 1 AND EVENTO = 'ENT'
        `;

        const found = await queryMSSQL(findQuery, params, 'NETPRO');
        const operators: string[] = found.recordset.map((r: any) => r.OGGETTO as string);

        if (operators.length === 0) {
            return { success: true, skipped: false, processed: 0, operators: [] };
        }

        // Build the full datetime string for the EXT event: YYYY-MM-DD HH:MM:SS.000
        const oraEvento = `${todayStr} ${exitTime}.000`;

        // Create EXT event and update STATO_FISICO for each operator
        for (const oggetto of operators) {
            await queryMSSQL(
                `INSERT INTO EVENTI (OGGETTO, EVENTO, ORA_EVENTO, TASK, TIPO_OGGETTO, SOURCE, UTENTE, OPERATORE)
                 VALUES (@oggetto, 'EXT', @oraEvento, 'presenza', 'OPE', 'WS', 'AUTO', @oggetto)`,
                { oggetto, oraEvento },
                'NETPRO'
            );
            await queryMSSQL(
                `UPDATE OPERATORI SET STATO_FISICO = 'OUT' WHERE OPERATORE = @oggetto`,
                { oggetto },
                'NETPRO'
            );
            await suspendActiveExecutionIfAny(oggetto, oraEvento);
        }

        return {
            success: true,
            skipped: false,
            processed: operators.length,
            operators,
            exitTime,
            date: todayStr,
        };
    } catch (err: any) {
        return {
            success: false,
            error: err.message as string,
            processed: 0,
        };
    }
}

import type { OperatorHoursRow, PresenceSettingRow, HoursDistributionField } from '@/types';
import {
    DEFAULT_PRESENCE_RULES,
    PRESENCE_SETTINGS,
    PRESENCE_SETTING_KEYS,
    parsePresenceRules,
    rulesForOperator,
    computeCountedDay,
    getDayKind,
    trackedRepartiSql,
    prefillRepartiSql,
    categoriaFromReparto,
    profileFromReparto,
    eachDateInRange,
    isPrefillableDay,
    todayLocal,
    distributeDay,
    hasAnyDistribution,
    assertCoversWorkday,
    proposalCoveredHours,
    type PresenceRulesConfig,
    type HourField,
    type DistributionProposal,
} from '@/lib/presence';

/**
 * Load the effective presence rules: defaults overridden by NETPRO.VALORI_TABELLE (PRESENZE).
 * Never throws — falls back to DEFAULT_PRESENCE_RULES if the DB is unreachable.
 */
async function loadPresenceRules(): Promise<PresenceRulesConfig> {
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

/** Effective presence rules for client components (config-driven badges, side effects, presets). */
export async function getPresenceRulesAction() {
    const rules = await loadPresenceRules();
    return { success: true as const, rules };
}

/** Build `(a LIKE @p0 OR b LIKE @p0 ...)` conditions for a comma-separated operator search. */
function buildOperatorSearch(
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

const DISTRIBUTION_SELECT = `
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

type DistributionRecord = Partial<Record<HourField | 'causale_ferie' | 'causale_permesso' | 'banca_ore_mese_n1' | 'banca_ore_mese_n', unknown>> & { operatore: string; data: string };

/** Map saved distributions by `operatore_YYYY-MM-DD`. */
async function loadDistributionMap(dateFrom: string, dateTo: string): Promise<Map<string, DistributionRecord>> {
    const res = await queryMSSQL<DistributionRecord>(DISTRIBUTION_SELECT, { dateFrom, dateTo }, 'QUOTES')
        .catch(() => ({ recordset: [] as DistributionRecord[] }));
    const map = new Map<string, DistributionRecord>();
    for (const d of res.recordset) {
        const dateStr = typeof d.data === 'string' ? d.data.substring(0, 10) : '';
        map.set(`${d.operatore}_${dateStr}`, d);
    }
    return map;
}

export async function getMonthlyHoursAction(
    dateFrom: string,
    dateTo: string,
    operatorFilter?: string
) {
    try {
        const rules = await loadPresenceRules();

        // --- Clock-in aggregates per operator-day (first entry / last exit; hours are computed by the rules) ---
        const params: Record<string, unknown> = { dateFrom, dateTo };
        const conditions: string[] = [
            "SIT.TIPO_OGGETTO = 'OPE'",
            "SIT.TIPO = 'CLCK'",
            'CAST(SIT.DATA AS DATE) >= @dateFrom',
            'CAST(SIT.DATA AS DATE) <= @dateTo',
        ];
        const sitSearch = buildOperatorSearch(operatorFilter, ['SIT.OGGETTO', 'OPE.NOME', 'OPE.MATRICOLA'], 'operator', params);
        if (sitSearch) conditions.push(sitSearch);

        const query = `
            SELECT
                SIT.OGGETTO AS operatore,
                ISNULL(NULLIF(LTRIM(RTRIM(OPE.MATRICOLA)), ''), NULL) AS matricola,
                ISNULL(OPE.NOME, SIT.OGGETTO) AS nome,
                ISNULL(NULLIF(LTRIM(RTRIM(OPE.GRUPPO)), ''), NULL) AS gruppo,
                ISNULL(NULLIF(LTRIM(RTRIM(OPE.ENTITA)), ''), NULL) AS reparto,
                CONVERT(VARCHAR(10), CAST(SIT.DATA AS DATE), 120) AS data,
                CONVERT(VARCHAR(8), MIN(SIT.ORA_INIZIO), 108) AS ora_inizio,
                CONVERT(VARCHAR(8), MAX(SIT.ORA_FINE), 108) AS ora_fine,
                COUNT(*) AS sessioni_count,
                SUM(DATEDIFF(MINUTE, SIT.ORA_INIZIO, SIT.ORA_FINE)) AS minuti_sessioni,
                ROUND(SUM(ISNULL(SIT.LAVORO, 0)), 2) AS ore_lavoro
            FROM SITUAZIONI SIT WITH (NOLOCK)
            LEFT JOIN OPERATORI OPE WITH (NOLOCK) ON SIT.OGGETTO = OPE.OPERATORE
            WHERE ${conditions.join(' AND ')}
            GROUP BY SIT.OGGETTO, OPE.MATRICOLA, OPE.NOME, OPE.GRUPPO, OPE.ENTITA, CAST(SIT.DATA AS DATE)
            ORDER BY data DESC, SIT.OGGETTO ASC
        `;

        // --- All tracked operators, so everyone appears even with 0 hours ---
        const opeParams: Record<string, unknown> = {};
        const opeConditions: string[] = [trackedRepartiSql('OPE.ENTITA')];
        const opeSearch = buildOperatorSearch(operatorFilter, ['OPE.OPERATORE', 'OPE.NOME', 'OPE.MATRICOLA'], 'opeFilter', opeParams);
        if (opeSearch) opeConditions.push(opeSearch);

        const opeQuery = `
            SELECT
                OPE.OPERATORE AS operatore,
                ISNULL(NULLIF(LTRIM(RTRIM(OPE.MATRICOLA)), ''), NULL) AS matricola,
                ISNULL(OPE.NOME, OPE.OPERATORE) AS nome,
                ISNULL(NULLIF(LTRIM(RTRIM(OPE.GRUPPO)), ''), NULL) AS gruppo,
                ISNULL(NULLIF(LTRIM(RTRIM(OPE.ENTITA)), ''), NULL) AS reparto
            FROM OPERATORI OPE WITH (NOLOCK)
            WHERE ${opeConditions.join(' AND ')}
            ORDER BY OPE.NOME ASC
        `;

        const [sitResult, opeResult, distMap] = await Promise.all([
            queryMSSQL(query, params, 'NETPRO'),
            queryMSSQL(opeQuery, opeParams, 'NETPRO'),
            loadDistributionMap(dateFrom, dateTo),
        ]);

        const records = [...sitResult.recordset];

        // Ensure every operator has a row for every calendar day in range
        const existingPairs = new Set(records.map((r: any) => `${String(r.operatore)}_${String(r.data)}`));
        for (const dateStr of eachDateInRange(dateFrom, dateTo)) {
            for (const op of opeResult.recordset) {
                const key = `${String(op.operatore)}_${dateStr}`;
                if (existingPairs.has(key)) continue;
                records.push({
                    operatore: op.operatore,
                    matricola: op.matricola,
                    nome: op.nome,
                    gruppo: op.gruppo,
                    reparto: op.reparto,
                    data: dateStr,
                    ora_inizio: null,
                    ora_fine: null,
                    sessioni_count: 0,
                    minuti_sessioni: null,
                    ore_lavoro: 0,
                });
                existingPairs.add(key);
            }
        }

        // Keep consistent sorting by date ASC, then operator name ASC
        records.sort((a, b) => {
            if (a.data !== b.data) return a.data.localeCompare(b.data);
            const nameA = String(a.nome || a.operatore).toLowerCase();
            const nameB = String(b.nome || b.operatore).toLowerCase();
            return nameA.localeCompare(nameB);
        });

        const num = (v: unknown): number | null => (v != null ? Number(v) : null);
        const str = (v: unknown): string | null => (v ? String(v) : null);

        // Enrich each row with the counted day (rules) and hours distributions
        const rows: OperatorHoursRow[] = records.map((row: any) => {
            const isSpecial = (row.gruppo ?? '').trim().toUpperCase() === 'TURNO2';
            const reparto = row.reparto ? String(row.reparto).trim() : null;
            const opRules = rulesForOperator(String(row.operatore), rules);
            const clock = {
                firstEntry: row.ora_inizio,
                lastExit: row.ora_fine,
                sessions: Number(row.sessioni_count ?? 0),
                sessionMinutes: row.minuti_sessioni != null ? Number(row.minuti_sessioni) : null,
            };
            const day = computeCountedDay(clock, opRules, getDayKind(row.data, opRules), profileFromReparto(reparto));

            const dist = distMap.get(`${row.operatore}_${row.data}`);

            return {
                operatore: row.operatore,
                matricola: row.matricola ?? null,
                nome: row.nome,
                gruppo: row.gruppo ?? null,
                reparto,
                categoria: categoriaFromReparto(reparto),
                turno: isSpecial ? 'TURNO2' : 'STD',
                data: row.data,
                ora_inizio: row.ora_inizio ?? null,
                ora_fine: row.ora_fine ?? null,
                sessioni_count: row.sessioni_count ?? 0,
                ore_lavoro: Number(row.ore_lavoro ?? 0),
                ore_totali: day.workedHours,
                turno_inizio: day.shiftStart,
                inizio_conteggiato: day.countedStart,
                fine_conteggiata: day.countedEnd,
                ore_ordinarie: num(dist?.ore_ordinarie),
                ore_straordinarie: num(dist?.ore_straordinarie),
                ore_ferie: num(dist?.ore_ferie),
                causale_ferie: str(dist?.causale_ferie),
                ore_permesso: num(dist?.ore_permesso),
                causale_permesso: str(dist?.causale_permesso),
                ore_malattia: num(dist?.ore_malattia),
                banca_ore: num(dist?.banca_ore),
                banca_ore_mese_n1: num(dist?.banca_ore_mese_n1),
                banca_ore_mese_n: num(dist?.banca_ore_mese_n),
            } satisfies OperatorHoursRow;
        });

        return { success: true, data: rows };
    } catch (err: any) {
        return {
            success: false,
            error: err.message as string,
            data: [] as OperatorHoursRow[],
        };
    }
}

/**
 * Upsert an hours distribution field for an operator on a specific date in CLZDWHQANDPROG
 */
export async function updateHoursDistributionAction(
    operatore: string,
    data: string,
    field: HoursDistributionField,
    value: number | string | null
) {
    try {
        const allowedFields: HoursDistributionField[] = [
            'ore_ordinarie',
            'ore_straordinarie',
            'ore_ferie',
            'causale_ferie',
            'ore_permesso',
            'causale_permesso',
            'ore_malattia',
            'banca_ore',
            'banca_ore_mese_n1',
            'banca_ore_mese_n',
        ];

        if (!allowedFields.includes(field)) {
            return { success: false, error: 'Campo non valido' };
        }

        const isTextField = field === 'causale_ferie' || field === 'causale_permesso';
        let paramValue: string | number | null = null;

        if (value !== null && value !== undefined && String(value).trim() !== '') {
            if (isTextField) {
                paramValue = String(value).trim();
            } else {
                const num = parseFloat(String(value));
                paramValue = !isNaN(num) ? num : null;
            }
        }

        const query = `
            MERGE presence_hours_distribution AS target
            USING (SELECT @operatore AS operatore, CAST(@data AS DATE) AS data) AS source
            ON (target.operatore = source.operatore AND target.data = source.data)
            WHEN MATCHED THEN
                UPDATE SET ${field} = @value, updated_at = SYSDATETIME()
            WHEN NOT MATCHED THEN
                INSERT (operatore, data, ${field}, created_at, updated_at)
                VALUES (@operatore, CAST(@data AS DATE), @value, SYSDATETIME(), SYSDATETIME());
        `;

        await queryMSSQL(
            query,
            {
                operatore,
                data,
                value: paramValue,
            },
            'QUOTES'
        );

        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message as string };
    }
}

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
 * Get a single presence configuration parameter from NETPRO.VALORI_TABELLE
 */
export async function getPresenceSettingAction(parametro: string) {
    try {
        const query = `
            SELECT TABELLA, PARAMETRO, VALORE, DESCRIZIONE, FVALUE01
            FROM VALORI_TABELLE WITH (NOLOCK)
            WHERE TABELLA = 'PRESENZE' AND PARAMETRO = @parametro
        `;
        const result = await queryMSSQL(query, { parametro }, 'NETPRO');
        if (result.recordset.length > 0) {
            return {
                success: true,
                data: result.recordset[0] as PresenceSettingRow,
            };
        }
        return {
            success: true,
            data: null,
        };
    } catch (err: any) {
        return {
            success: false,
            error: err.message as string,
            data: null,
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


/**
 * Get all operators currently assigned to TURNO2 (GRUPPO = 'TURNO2')
 */
export async function getTurno2OperatorsAction() {
    try {
        const result = await queryMSSQL(
            `SELECT OPERATORE, NOME, GRUPPO
             FROM OPERATORI WITH (NOLOCK)
             WHERE UPPER(LTRIM(RTRIM(GRUPPO))) = 'TURNO2'
             ORDER BY NOME ASC`,
            {},
            'NETPRO'
        );
        return {
            success: true,
            data: result.recordset as { OPERATORE: string; NOME: string; GRUPPO: string }[],
        };
    } catch (err: any) {
        return { success: false, error: err.message as string, data: [] as { OPERATORE: string; NOME: string; GRUPPO: string }[] };
    }
}

/**
 * Search operators by name or code (for the add-to-TURNO2 picker)
 */
export async function searchOperatorsAction(term: string) {
    try {
        const result = await queryMSSQL(
            `SELECT TOP 20 OPERATORE, NOME, ISNULL(NULLIF(LTRIM(RTRIM(GRUPPO)), ''), NULL) AS GRUPPO
             FROM OPERATORI WITH (NOLOCK)
             WHERE (OPERATORE LIKE @term OR NOME LIKE @term)
             ORDER BY NOME ASC`,
            { term: `%${term}%` },
            'NETPRO'
        );
        return {
            success: true,
            data: result.recordset as { OPERATORE: string; NOME: string; GRUPPO: string | null }[],
        };
    } catch (err: any) {
        return { success: false, error: err.message as string, data: [] as { OPERATORE: string; NOME: string; GRUPPO: string | null }[] };
    }
}

/**
 * Set or clear the GRUPPO field on an operator (live production — parameterized only)
 * Pass gruppo = 'TURNO2' to assign, or gruppo = '' to reset to standard
 */
export async function setOperatorGruppoAction(operatore: string, gruppo: string) {
    try {
        await queryMSSQL(
            `UPDATE OPERATORI SET GRUPPO = @gruppo WHERE OPERATORE = @operatore`,
            { operatore, gruppo: gruppo || '' },
            'NETPRO'
        );
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message as string };
    }
}

/** Columns the prefill may write. Order matters: it is shared by the VALUES clause and the MERGE. */
const PREFILL_COLUMNS: readonly HourField[] = [
    'ore_ordinarie',
    'ore_straordinarie',
    'ore_ferie',
    'ore_permesso',
    'ore_malattia',
    'banca_ore',
];

interface PrefillCandidate {
    operatore: string;
    data: string;
    proposal: DistributionProposal;
    /** Rules the proposal was computed with (per-operator exceptions applied). */
    rules: PresenceRulesConfig;
}

export interface PrefillResult {
    success: boolean;
    error?: string;
    dryRun?: boolean;
    message?: string;
    /** Rows proposed (dry run) or written. */
    totalCount: number;
    absencesCount: number;
    partialCount: number;
    fullCount: number;
    /** Full days that also received an overflow value (e.g. banca ore). */
    overflowCount: number;
    /** Extra days (e.g. Saturday) with records → hours into extraField. */
    extraCount: number;
    /** Fixed-profile working days (e.g. office) → flat workdayHours ordinarie. */
    fixedCount: number;
    /** Snapshot of the rules used, so the UI can describe what was applied. */
    rules?: PresenceRulesConfig;
}

const EMPTY_PREFILL: Omit<PrefillResult, 'success'> = {
    totalCount: 0,
    absencesCount: 0,
    partialCount: 0,
    fullCount: 0,
    overflowCount: 0,
    extraCount: 0,
    fixedCount: 0,
};

/**
 * Batch pre-populate hours for tracked operators on past working days in the range
 * that have no distribution yet. The formula lives in src/lib/presence/formulas/distribution.ts
 * and every number comes from the presence rules (DB / PRESENCE_RULES defaults).
 *
 * dryRun = true only counts candidates; nothing is written.
 */
export async function prefillAbsencesAction(dateFrom: string, dateTo: string, dryRun: boolean = false): Promise<PrefillResult> {
    try {
        const rules = await loadPresenceRules();
        const todayStr = todayLocal();

        // 1. Working days strictly before today
        const workdays = eachDateInRange(dateFrom, dateTo).filter((d) => isPrefillableDay(d, todayStr, rules));
        if (workdays.length === 0) {
            return {
                success: true,
                ...EMPTY_PREFILL,
                dryRun,
                rules,
                message: 'Nessun giorno lavorativo passato nell’intervallo (oggi e date future escluse)',
            };
        }

        // 2. Operators in the categories the prefill applies to, with their rule profile
        //    (see PRESENCE_RULES.CATEGORIES → profile)
        const opeResult = await queryMSSQL<{ OPERATORE: string; ENTITA: string | null }>(
            `SELECT OPERATORE, ENTITA FROM OPERATORI WITH (NOLOCK) WHERE ${prefillRepartiSql('ENTITA')}`,
            {},
            'NETPRO'
        );
        const operators = opeResult.recordset.map((r) => ({
            operatore: String(r.OPERATORE),
            profile: profileFromReparto(r.ENTITA),
        }));
        if (operators.length === 0) {
            return { success: true, ...EMPTY_PREFILL, dryRun, rules };
        }

        // 3. Worked hours per operator-day (same formula as the dashboard) + existing distributions
        const [sitResult, existingDist] = await Promise.all([
            queryMSSQL<{ operatore: string; data: string; ora_inizio: string | null; ora_fine: string | null; sessioni_count: number; minuti_sessioni: number | null }>(
                `SELECT
                    SIT.OGGETTO AS operatore,
                    CONVERT(VARCHAR(10), CAST(SIT.DATA AS DATE), 120) AS data,
                    CONVERT(VARCHAR(8), MIN(SIT.ORA_INIZIO), 108) AS ora_inizio,
                    CONVERT(VARCHAR(8), MAX(SIT.ORA_FINE), 108) AS ora_fine,
                    COUNT(*) AS sessioni_count,
                    SUM(DATEDIFF(MINUTE, SIT.ORA_INIZIO, SIT.ORA_FINE)) AS minuti_sessioni
                 FROM SITUAZIONI SIT WITH (NOLOCK)
                 WHERE SIT.TIPO_OGGETTO = 'OPE' AND SIT.TIPO = 'CLCK'
                   AND CAST(SIT.DATA AS DATE) >= @dateFrom AND CAST(SIT.DATA AS DATE) <= @dateTo
                 GROUP BY SIT.OGGETTO, CAST(SIT.DATA AS DATE)`,
                { dateFrom, dateTo },
                'NETPRO'
            ),
            loadDistributionMap(dateFrom, dateTo),
        ]);

        // Same formula as the dashboard: counted start/end → worked hours (per day kind + profile)
        const profileByOperator = new Map(operators.map((o) => [o.operatore, o.profile] as const));
        const workedHoursMap = new Map<string, number>();
        for (const r of sitResult.recordset) {
            const operatore = String(r.operatore);
            const data = String(r.data);
            const profile = profileByOperator.get(operatore) ?? 'standard';
            const opRules = rulesForOperator(operatore, rules);
            const clock = {
                firstEntry: r.ora_inizio,
                lastExit: r.ora_fine,
                sessions: Number(r.sessioni_count ?? 0),
                sessionMinutes: r.minuti_sessioni != null ? Number(r.minuti_sessioni) : null,
            };
            const day = computeCountedDay(clock, opRules, getDayKind(data, opRules), profile);
            workedHoursMap.set(`${operatore}_${data}`, day.workedHours);
        }

        // 4. Evaluate each candidate operator-day
        const candidates: PrefillCandidate[] = [];
        const counts = { ...EMPTY_PREFILL };

        for (const data of workdays) {
            const dayKind = getDayKind(data, rules);
            for (const { operatore, profile } of operators) {
                const key = `${operatore}_${data}`;
                if (hasAnyDistribution(existingDist.get(key))) continue; // preserve manual data

                const opRules = rulesForOperator(operatore, rules);
                const proposal = distributeDay(workedHoursMap.get(key) ?? 0, dayKind, opRules, profile);
                if (!proposal) continue; // e.g. extra day without records → stays empty
                candidates.push({ operatore, data, proposal, rules: opRules });

                switch (proposal.category) {
                    case 'absence': counts.absencesCount++; break;
                    case 'partial': counts.partialCount++; break;
                    case 'extra': counts.extraCount++; break;
                    case 'fixed': counts.fixedCount++; break;
                    case 'full':
                        counts.fullCount++;
                        if (proposal.values[rules.overflowField] !== undefined) counts.overflowCount++;
                        break;
                }
            }
        }
        counts.totalCount = candidates.length;

        if (candidates.length === 0 || dryRun) {
            return { success: true, ...counts, dryRun, rules };
        }

        // 5. Invariant: every proposal must cover exactly the workday
        const broken = candidates.find((c) => !assertCoversWorkday(c.proposal, c.rules));
        if (broken) {
            return {
                success: false,
                ...EMPTY_PREFILL,
                error: `Regola ${broken.rules.workdayHours}h violata per ${broken.operatore} il ${broken.data}: copertura ${proposalCoveredHours(broken.proposal, broken.rules)}h. Controllare le impostazioni presenze.`,
            };
        }

        // 6. Batch MERGE in chunks — only rows still empty are touched
        const chunkSize = 50;
        const colList = PREFILL_COLUMNS.join(', ');
        const guard = PREFILL_COLUMNS.map((c) => `target.${c} IS NULL`).join(' AND ') +
            ' AND target.causale_ferie IS NULL AND target.causale_permesso IS NULL';
        const setList = PREFILL_COLUMNS.map((c) => `${c} = source.${c}`).join(', ');
        const srcList = PREFILL_COLUMNS.map((c) => `source.${c}`).join(', ');

        for (let i = 0; i < candidates.length; i += chunkSize) {
            const chunk = candidates.slice(i, i + chunkSize);
            const params: Record<string, unknown> = {};
            const valuesClauses = chunk.map((c, idx) => {
                params[`op${idx}`] = c.operatore;
                params[`dt${idx}`] = c.data;
                const cols = PREFILL_COLUMNS.map((col, ci) => {
                    params[`v${idx}_${ci}`] = c.proposal.values[col] ?? null;
                    return `CAST(@v${idx}_${ci} AS DECIMAL(5,2))`;
                });
                return `(@op${idx}, CAST(@dt${idx} AS DATE), ${cols.join(', ')})`;
            }).join(', ');

            await queryMSSQL(
                `MERGE presence_hours_distribution AS target
                 USING (VALUES ${valuesClauses}) AS source (operatore, data, ${colList})
                 ON (target.operatore = source.operatore AND target.data = source.data)
                 WHEN MATCHED AND ${guard} THEN
                     UPDATE SET ${setList}, updated_at = SYSDATETIME()
                 WHEN NOT MATCHED THEN
                     INSERT (operatore, data, ${colList}, created_at, updated_at)
                     VALUES (source.operatore, source.data, ${srcList}, SYSDATETIME(), SYSDATETIME());`,
                params,
                'QUOTES'
            );
        }

        return { success: true, ...counts, dryRun: false, rules };
    } catch (err: any) {
        return { success: false, ...EMPTY_PREFILL, error: err.message as string };
    }
}
