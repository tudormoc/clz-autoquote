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

import type { OperatorHoursRow, PresenceSettingRow } from '@/types';

export async function getMonthlyHoursAction(
    dateFrom: string,
    dateTo: string,
    operatorFilter?: string
) {
    try {
        const conditions: string[] = [
            "SIT.TIPO_OGGETTO = 'OPE'",
            "SIT.TIPO = 'CLCK'",
            "CAST(SIT.DATA AS DATE) >= @dateFrom",
            "CAST(SIT.DATA AS DATE) <= @dateTo",
        ];

        // Load all 5 PRESENZE params in a single query
        let pauseMinutes = 60;
        let stdStart = '08:00';
        let stdEnd = '17:00';
        let specStart = '06:00';
        let specEnd = '15:00';

        try {
            const paramsRes = await queryMSSQL(
                `SELECT PARAMETRO, VALORE, FVALUE01
                 FROM VALORI_TABELLE WITH (NOLOCK)
                 WHERE TABELLA = 'PRESENZE'
                   AND PARAMETRO IN ('PAUSA_MINUTI','STD_START','STD_END','SPEC_START','SPEC_END')`,
                {},
                'NETPRO'
            );
            for (const row of paramsRes.recordset) {
                const v = (row.VALORE ?? '').trim();
                switch (row.PARAMETRO) {
                    case 'PAUSA_MINUTI': {
                        const n = row.FVALUE01 ?? parseFloat(v);
                        if (!isNaN(n)) pauseMinutes = n;
                        break;
                    }
                    case 'STD_START': if (v) stdStart = v; break;
                    case 'STD_END':   if (v) stdEnd   = v; break;
                    case 'SPEC_START': if (v) specStart = v; break;
                    case 'SPEC_END':   if (v) specEnd   = v; break;
                }
            }
        } catch {
            // Use hardcoded defaults if DB read fails
        }

        // Helper: convert "HH:MM" to total minutes since midnight
        const toMin = (t: string) => {
            const [h, m] = t.split(':').map(Number);
            return h * 60 + m;
        };

        const params: Record<string, any> = { dateFrom, dateTo, pauseMinutes };

        if (operatorFilter && operatorFilter.trim()) {
            const operatorTerms = operatorFilter.split(',').map(o => o.trim()).filter(o => o);
            if (operatorTerms.length > 0) {
                const termConditions = operatorTerms.map((_, i) =>
                    `(SIT.OGGETTO LIKE @operator${i} OR OPE.NOME LIKE @operator${i})`
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
                SIT.OGGETTO AS operatore,
                ISNULL(OPE.NOME, SIT.OGGETTO) AS nome,
                ISNULL(NULLIF(LTRIM(RTRIM(OPE.GRUPPO)), ''), NULL) AS gruppo,
                CONVERT(VARCHAR(10), CAST(SIT.DATA AS DATE), 120) AS data,
                CONVERT(VARCHAR(8), MIN(SIT.ORA_INIZIO), 108) AS ora_inizio,
                CONVERT(VARCHAR(8), MAX(SIT.ORA_FINE), 108) AS ora_fine,
                COUNT(*) AS sessioni_count,
                ROUND(SUM(ISNULL(SIT.LAVORO, 0)), 2) AS ore_lavoro,
                ROUND(CASE
                    WHEN DATEDIFF(MINUTE, MIN(SIT.ORA_INIZIO), MAX(SIT.ORA_FINE)) > @pauseMinutes
                    THEN (DATEDIFF(MINUTE, MIN(SIT.ORA_INIZIO), MAX(SIT.ORA_FINE)) - @pauseMinutes) / 60.0
                    ELSE 0
                END, 2) AS ore_totali
            FROM SITUAZIONI SIT WITH (NOLOCK)
            LEFT JOIN OPERATORI OPE WITH (NOLOCK) ON SIT.OGGETTO = OPE.OPERATORE
            WHERE ${whereClause}
            GROUP BY SIT.OGGETTO, OPE.NOME, OPE.GRUPPO, CAST(SIT.DATA AS DATE)
            ORDER BY data DESC, SIT.OGGETTO ASC
        `;

        const result = await queryMSSQL(query, params, 'NETPRO');

        // Enrich each row with schedule info resolved from GRUPPO
        const rows: OperatorHoursRow[] = result.recordset.map((row: any) => {
            const isSpecial = (row.gruppo ?? '').trim().toUpperCase() === 'TURNO2';
            const expectedStart = isSpecial ? specStart : stdStart;
            const expectedEnd   = isSpecial ? specEnd   : stdEnd;

            // Parse actual times (HH:MM from VARCHAR(8) = HH:MM:SS)
            const actualStartMin = toMin(row.ora_inizio?.substring(0, 5) ?? '00:00');
            const actualEndMin   = toMin(row.ora_fine?.substring(0, 5) ?? '00:00');
            const expStartMin    = toMin(expectedStart.substring(0, 5));
            const expEndMin      = toMin(expectedEnd.substring(0, 5));

            return {
                operatore: row.operatore,
                nome: row.nome,
                gruppo: row.gruppo ?? null,
                turno: isSpecial ? 'TURNO2' : 'STD',
                data: row.data,
                ora_inizio: row.ora_inizio,
                ora_fine: row.ora_fine,
                sessioni_count: row.sessioni_count,
                ore_lavoro: row.ore_lavoro,
                ore_totali: row.ore_totali,
                inizio_atteso: expectedStart,
                fine_attesa: expectedEnd,
                // Positive = late/missing, negative = early
                diff_inizio_min: actualStartMin - expStartMin,
                diff_fine_min: actualEndMin - expEndMin,
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
 * Get all presence configuration parameters from NETPRO.VALORI_TABELLE
 */
export async function getAllPresenceSettingsAction() {
    try {
        const query = `
            SELECT TABELLA, PARAMETRO, VALORE, DESCRIZIONE, FVALUE01
            FROM VALORI_TABELLE WITH (NOLOCK)
            WHERE TABELLA = 'PRESENZE'
            ORDER BY 
                CASE PARAMETRO
                    WHEN 'STD_START' THEN 1
                    WHEN 'STD_END' THEN 2
                    WHEN 'SPEC_START' THEN 3
                    WHEN 'SPEC_END' THEN 4
                    WHEN 'PAUSA_MINUTI' THEN 5
                    ELSE 99
                END,
                PARAMETRO ASC
        `;
        const result = await queryMSSQL(query, {}, 'NETPRO');
        return {
            success: true,
            data: result.recordset as PresenceSettingRow[],
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
