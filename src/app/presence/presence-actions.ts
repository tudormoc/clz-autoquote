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
                    `(SIT.OGGETTO LIKE @operator${i} OR OPE.NOME LIKE @operator${i} OR OPE.MATRICOLA LIKE @operator${i})`
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
                ISNULL(NULLIF(LTRIM(RTRIM(OPE.MATRICOLA)), ''), NULL) AS matricola,
                ISNULL(OPE.NOME, SIT.OGGETTO) AS nome,
                ISNULL(NULLIF(LTRIM(RTRIM(OPE.GRUPPO)), ''), NULL) AS gruppo,
                ISNULL(NULLIF(LTRIM(RTRIM(OPE.ENTITA)), ''), NULL) AS reparto,
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
            GROUP BY SIT.OGGETTO, OPE.MATRICOLA, OPE.NOME, OPE.GRUPPO, OPE.ENTITA, CAST(SIT.DATA AS DATE)
            ORDER BY data DESC, SIT.OGGETTO ASC
        `;

        // Query all operators in categories 2, 3, 1001 to ensure everyone appears even with 0 hours
        const opeParams: Record<string, any> = {};
        const opeConditions: string[] = ["OPE.ENTITA IN ('2', '3', '1001')"];

        if (operatorFilter && operatorFilter.trim()) {
            const operatorTerms = operatorFilter.split(',').map(o => o.trim()).filter(o => o);
            if (operatorTerms.length > 0) {
                const opeTermConditions = operatorTerms.map((_, i) =>
                    `(OPE.OPERATORE LIKE @opeFilter${i} OR OPE.NOME LIKE @opeFilter${i} OR OPE.MATRICOLA LIKE @opeFilter${i})`
                );
                opeConditions.push(`(${opeTermConditions.join(' OR ')})`);
                operatorTerms.forEach((term, i) => {
                    opeParams[`opeFilter${i}`] = `%${term}%`;
                });
            }
        }

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

        const distQuery = `
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

        const [sitResult, opeResult, distResult] = await Promise.all([
            queryMSSQL(query, params, 'NETPRO'),
            queryMSSQL(opeQuery, opeParams, 'NETPRO'),
            queryMSSQL(distQuery, { dateFrom, dateTo }, 'QUOTES').catch(() => ({ recordset: [] })),
        ]);

        const records = [...sitResult.recordset];

        // Generate all calendar dates in the range (including Saturdays and Sundays)
        const allDates: string[] = [];
        const [sy, sm, sd] = dateFrom.split('-').map(Number);
        const [ey, em, ed] = dateTo.split('-').map(Number);
        const curDate = new Date(sy, sm - 1, sd, 12, 0, 0);
        const stopDate = new Date(ey, em - 1, ed, 12, 0, 0);
        while (curDate <= stopDate) {
            const y = curDate.getFullYear();
            const m = String(curDate.getMonth() + 1).padStart(2, '0');
            const d = String(curDate.getDate()).padStart(2, '0');
            allDates.push(`${y}-${m}-${d}`);
            curDate.setDate(curDate.getDate() + 1);
        }

        // Track existing (operatore_data) pairs so every operator has a row for every day
        const existingPairs = new Set(
            records.map((r: any) => `${String(r.operatore)}_${String(r.data)}`)
        );

        for (const dateStr of allDates) {
            for (const op of opeResult.recordset) {
                const key = `${String(op.operatore)}_${dateStr}`;
                if (!existingPairs.has(key)) {
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
                        ore_lavoro: 0,
                        ore_totali: 0,
                    });
                    existingPairs.add(key);
                }
            }
        }

        // Keep consistent sorting by date ASC, then operator name ASC
        records.sort((a, b) => {
            if (a.data !== b.data) {
                return a.data.localeCompare(b.data);
            }
            const nameA = String(a.nome || a.operatore).toLowerCase();
            const nameB = String(b.nome || b.operatore).toLowerCase();
            return nameA.localeCompare(nameB);
        });

        // Map saved hours distribution by operatore_data
        const distMap = new Map<string, any>();
        for (const d of distResult.recordset) {
            const dateStr = typeof d.data === 'string' ? d.data.substring(0, 10) : '';
            distMap.set(`${d.operatore}_${dateStr}`, d);
        }

        // Enrich each row with schedule info resolved from GRUPPO and hours distributions
        const rows: OperatorHoursRow[] = records.map((row: any) => {
            const isSpecial = (row.gruppo ?? '').trim().toUpperCase() === 'TURNO2';
            const expectedStart = isSpecial ? specStart : stdStart;
            const expectedEnd   = isSpecial ? specEnd   : stdEnd;

            // Resolve employee category from reparto (OPE.ENTITA)
            const reparto = row.reparto ? String(row.reparto).trim() : null;
            let categoria: 'Interinali' | 'CLZ Produzione' | 'CLZ Ufficio' | 'Altro' = 'Altro';
            if (reparto === '1001') {
                categoria = 'Interinali';
            } else if (reparto === '2') {
                categoria = 'CLZ Produzione';
            } else if (reparto === '3') {
                categoria = 'CLZ Ufficio';
            }

            // Parse actual times (HH:MM from VARCHAR(8) = HH:MM:SS)
            const hasClock = Boolean(row.ora_inizio);
            const actualStartMin = hasClock ? toMin(row.ora_inizio.substring(0, 5)) : 0;
            const actualEndMin   = hasClock && row.ora_fine ? toMin(row.ora_fine.substring(0, 5)) : 0;
            const expStartMin    = toMin(expectedStart.substring(0, 5));
            const expEndMin      = toMin(expectedEnd.substring(0, 5));

            const dist = distMap.get(`${row.operatore}_${row.data}`);

            return {
                operatore: row.operatore,
                matricola: row.matricola ?? null,
                nome: row.nome,
                gruppo: row.gruppo ?? null,
                reparto,
                categoria,
                turno: isSpecial ? 'TURNO2' : 'STD',
                data: row.data,
                ora_inizio: row.ora_inizio ?? null,
                ora_fine: row.ora_fine ?? null,
                sessioni_count: row.sessioni_count ?? 0,
                ore_lavoro: Number(row.ore_lavoro ?? 0),
                ore_totali: Number(row.ore_totali ?? 0),
                inizio_atteso: expectedStart,
                fine_attesa: expectedEnd,
                // Positive = late/missing, negative = early
                diff_inizio_min: hasClock ? actualStartMin - expStartMin : 0,
                diff_fine_min: hasClock && row.ora_fine ? actualEndMin - expEndMin : 0,
                ore_ordinarie: dist?.ore_ordinarie != null ? Number(dist.ore_ordinarie) : null,
                ore_straordinarie: dist?.ore_straordinarie != null ? Number(dist.ore_straordinarie) : null,
                ore_ferie: dist?.ore_ferie != null ? Number(dist.ore_ferie) : null,
                causale_ferie: dist?.causale_ferie ? String(dist.causale_ferie) : null,
                ore_permesso: dist?.ore_permesso != null ? Number(dist.ore_permesso) : null,
                causale_permesso: dist?.causale_permesso ? String(dist.causale_permesso) : null,
                ore_malattia: dist?.ore_malattia != null ? Number(dist.ore_malattia) : null,
                banca_ore: dist?.banca_ore != null ? Number(dist.banca_ore) : null,
                banca_ore_mese_n1: dist?.banca_ore_mese_n1 != null ? Number(dist.banca_ore_mese_n1) : null,
                banca_ore_mese_n: dist?.banca_ore_mese_n != null ? Number(dist.banca_ore_mese_n) : null,
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
 * Get configured presets for Ferie and Permesso from NETPRO.VALORI_TABELLE
 */
export async function getPresencePresetsAction() {
    try {
        const query = `
            SELECT PARAMETRO, VALORE
            FROM VALORI_TABELLE WITH (NOLOCK)
            WHERE TABELLA = 'PRESENZE' AND PARAMETRO IN ('FERIE_PRESETS', 'PERMESSO_PRESETS')
        `;
        const result = await queryMSSQL(query, {}, 'NETPRO');
        let feriePresets: string[] = ['FESTA'];
        let permessoPresets: string[] = ['ROL', 'VISITA MEDICA', 'LUTTO'];

        for (const row of result.recordset) {
            if (row.PARAMETRO === 'FERIE_PRESETS' && row.VALORE) {
                feriePresets = row.VALORE.split(',').map((s: string) => s.trim()).filter(Boolean);
            } else if (row.PARAMETRO === 'PERMESSO_PRESETS' && row.VALORE) {
                permessoPresets = row.VALORE.split(',').map((s: string) => s.trim()).filter(Boolean);
            }
        }

        return {
            success: true,
            feriePresets,
            permessoPresets,
        };
    } catch {
        return {
            success: true,
            feriePresets: ['FESTA'],
            permessoPresets: ['ROL', 'VISITA MEDICA', 'LUTTO'],
        };
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
        const defaultDesc = parametro === 'FERIE_PRESETS'
            ? 'Opzioni rapide testo per Ore Ferie (separate da virgola)'
            : 'Opzioni rapide testo per Ore Permesso (separate da virgola)';

        // 1. Update presets string in NETPRO.VALORI_TABELLE
        await updatePresenceSettingAction(parametro, updatedPresetsValue, defaultDesc);

        // 2. Cascade update to all employee rows in CLZDWHQANDPROG
        const col = parametro === 'FERIE_PRESETS' ? 'ore_ferie' : 'ore_permesso';
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

/**
 * Batch pre-populate and auto-distribute hours for operators (Monday - Friday only, strictly before today)
 * in the specified date range where no hours distribution has been entered yet:
 * 1. Full/Overtime (Totale Ore >= 8.0): 8.0 Ordinarie, and Banca Ore if diff >= 1.0 (whole hours).
 * 2. Partial presence (0 < Totale Ore < 8.0): Ordinarie (rounded down to 0.5h) + Permesso for remainder, sum always 8.0.
 * 3. Full Absences (Totale Ore <= 0): 8.0 Ferie.
 */
export async function prefillAbsencesAction(dateFrom: string, dateTo: string, dryRun: boolean = false) {
    try {
        // 1. Get all dates between dateFrom and dateTo that are weekdays (Monday=1 .. Friday=5)
        const [sy, sm, sd] = dateFrom.split('-').map(Number);
        const [ey, em, ed] = dateTo.split('-').map(Number);
        const curr = new Date(sy, sm - 1, sd, 12, 0, 0);
        const end = new Date(ey, em - 1, ed, 12, 0, 0);

        const now = new Date();
        const yNow = now.getFullYear();
        const mNow = String(now.getMonth() + 1).padStart(2, '0');
        const dNow = String(now.getDate()).padStart(2, '0');
        const todayStr = `${yNow}-${mNow}-${dNow}`;

        const weekdays: string[] = [];
        while (curr <= end) {
            const day = curr.getDay(); // 0 = Sun, 6 = Sat
            const y = curr.getFullYear();
            const m = String(curr.getMonth() + 1).padStart(2, '0');
            const d = String(curr.getDate()).padStart(2, '0');
            const dateStr = `${y}-${m}-${d}`;

            // Only Monday-Friday and strictly past dates (exclude today and future)
            if (day !== 0 && day !== 6 && dateStr < todayStr) {
                weekdays.push(dateStr);
            }
            curr.setDate(curr.getDate() + 1);
        }

        if (weekdays.length === 0) {
            return {
                success: true,
                count: 0,
                totalCount: 0,
                absencesCount: 0,
                partialCount: 0,
                fullCount: 0,
                bancaOreCount: 0,
                message: 'Nessun giorno lavorativo passato nell’intervallo (oggi e date future escluse)',
            };
        }

        // 2. Query configured pause minutes
        let pauseMinutes = 60;
        try {
            const pauseRes = await queryMSSQL(`
                SELECT TOP 1 VALORE, FVALUE01
                FROM VALORI_TABELLE WITH (NOLOCK)
                WHERE TABELLA = 'PRESENZE' AND PARAMETRO = 'PAUSA_MINUTI'
            `, {}, 'NETPRO');
            if (pauseRes.recordset.length > 0) {
                const row = pauseRes.recordset[0];
                const n = row.FVALUE01 ?? parseFloat(row.VALORE);
                if (!isNaN(n)) pauseMinutes = n;
            }
        } catch {
            // default 60
        }

        // 3. Query active operators in categories 2, 3, 1001
        const opeResult = await queryMSSQL(`
            SELECT OPERATORE
            FROM OPERATORI WITH (NOLOCK)
            WHERE ENTITA IN ('2', '3', '1001')
        `, {}, 'NETPRO');

        const operators = opeResult.recordset.map((r: any) => String(r.OPERATORE));
        if (operators.length === 0) {
            return { success: true, count: 0, totalCount: 0, absencesCount: 0, partialCount: 0, fullCount: 0, bancaOreCount: 0 };
        }

        // 4. Query clock-ins from SITUAZIONI and calculate totale_ore
        const sitResult = await queryMSSQL(`
            SELECT
                SIT.OGGETTO AS operatore,
                CONVERT(VARCHAR(10), CAST(SIT.DATA AS DATE), 120) AS data,
                ROUND(CASE
                    WHEN DATEDIFF(MINUTE, MIN(SIT.ORA_INIZIO), MAX(SIT.ORA_FINE)) > @pauseMinutes
                    THEN (DATEDIFF(MINUTE, MIN(SIT.ORA_INIZIO), MAX(SIT.ORA_FINE)) - @pauseMinutes) / 60.0
                    ELSE 0
                END, 2) AS ore_totali
            FROM SITUAZIONI SIT WITH (NOLOCK)
            WHERE CAST(SIT.DATA AS DATE) >= @dateFrom AND CAST(SIT.DATA AS DATE) <= @dateTo
            GROUP BY SIT.OGGETTO, CAST(SIT.DATA AS DATE)
        `, { dateFrom, dateTo, pauseMinutes }, 'NETPRO');

        const workedHoursMap = new Map<string, number>();
        for (const r of sitResult.recordset) {
            workedHoursMap.set(`${String(r.operatore)}_${String(r.data)}`, Number(r.ore_totali ?? 0));
        }

        // 5. Query existing distributions from CLZDWHQANDPROG
        const distResult = await queryMSSQL(`
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
                banca_ore
            FROM presence_hours_distribution WITH (NOLOCK)
            WHERE data >= @dateFrom AND data <= @dateTo
        `, { dateFrom, dateTo }, 'QUOTES').catch(() => ({ recordset: [] }));

        const existingDist = new Map<string, any>();
        for (const d of distResult.recordset) {
            const dateStr = typeof d.data === 'string' ? d.data.substring(0, 10) : '';
            existingDist.set(`${d.operatore}_${dateStr}`, d);
        }

        // 6. Evaluate each candidate operator-day
        interface CandidateRow {
            operatore: string;
            data: string;
            ore_ordinarie: string | null;
            ore_ferie: string | null;
            ore_permesso: string | null;
            banca_ore: string | null;
            category: 'absence' | 'partial' | 'full';
        }

        const toPrefill: CandidateRow[] = [];
        let absencesCount = 0;
        let partialCount = 0;
        let fullCount = 0;
        let bancaOreCount = 0;

        for (const dateStr of weekdays) {
            for (const op of operators) {
                const key = `${op}_${dateStr}`;

                // Skip if this operator-day already has any distribution field manually set
                const dist = existingDist.get(key);
                if (dist) {
                    const hasOrd = dist.ore_ordinarie !== null && dist.ore_ordinarie !== undefined;
                    const hasFerie = (dist.ore_ferie !== null && dist.ore_ferie !== undefined && String(dist.ore_ferie).trim() !== '') || Boolean(dist.causale_ferie);
                    const hasPermesso = (dist.ore_permesso !== null && dist.ore_permesso !== undefined && String(dist.ore_permesso).trim() !== '') || Boolean(dist.causale_permesso);
                    const hasMalattia = dist.ore_malattia !== null && dist.ore_malattia !== undefined && String(dist.ore_malattia).trim() !== '';
                    const hasBanca = dist.banca_ore !== null && dist.banca_ore !== undefined;
                    if (hasOrd || hasFerie || hasPermesso || hasMalattia || hasBanca) {
                        continue; // Preserve existing data
                    }
                }

                const totalWorked = workedHoursMap.get(key) ?? 0;

                if (totalWorked <= 0) {
                    // Case 1: Absence -> 8.0h Ferie
                    toPrefill.push({
                        operatore: op,
                        data: dateStr,
                        ore_ordinarie: null,
                        ore_ferie: '8.0',
                        ore_permesso: null,
                        banca_ore: null,
                        category: 'absence',
                    });
                    absencesCount++;
                } else if (totalWorked < 8.0) {
                    // Case 2: Partial presence -> Ordinarie (rounded to 0.5h) + Permesso (sum is exactly 8.0)
                    const ordVal = Math.floor(totalWorked * 2) / 2;
                    const perVal = Math.round((8.0 - ordVal) * 10) / 10;
                    toPrefill.push({
                        operatore: op,
                        data: dateStr,
                        ore_ordinarie: ordVal.toFixed(1),
                        ore_ferie: null,
                        ore_permesso: perVal.toFixed(1),
                        banca_ore: null,
                        category: 'partial',
                    });
                    partialCount++;
                } else {
                    // Case 3: Full / Overtime -> 8.0 Ordinarie, extra whole hours (>= 1.0) into Banca Ore
                    const diff = totalWorked - 8.0;
                    const bancaVal = diff >= 1.0 ? Math.floor(diff) : null;
                    if (bancaVal !== null) {
                        bancaOreCount++;
                    }
                    toPrefill.push({
                        operatore: op,
                        data: dateStr,
                        ore_ordinarie: '8.0',
                        ore_ferie: null,
                        ore_permesso: null,
                        banca_ore: bancaVal !== null ? bancaVal.toFixed(1) : null,
                        category: 'full',
                    });
                    fullCount++;
                }
            }
        }

        if (toPrefill.length === 0) {
            return {
                success: true,
                count: 0,
                totalCount: 0,
                absencesCount: 0,
                partialCount: 0,
                fullCount: 0,
                bancaOreCount: 0,
                dryRun,
            };
        }

        if (dryRun) {
            return {
                success: true,
                count: toPrefill.length,
                totalCount: toPrefill.length,
                absencesCount,
                partialCount,
                fullCount,
                bancaOreCount,
                dryRun: true,
            };
        }

        // 7. Verify 8.0h rule integrity: ordinarie + ferie + permesso MUST equal exactly 8.0
        for (const item of toPrefill) {
            const ord = item.ore_ordinarie !== null ? parseFloat(item.ore_ordinarie) : 0;
            const fer = item.ore_ferie !== null ? parseFloat(item.ore_ferie) : 0;
            const per = item.ore_permesso !== null ? parseFloat(item.ore_permesso) : 0;
            const sum = Math.round((ord + fer + per) * 10) / 10;
            if (sum !== 8.0) {
                console.error(`8h rule assertion failed for operator ${item.operatore} on ${item.data}: sum is ${sum}`);
            }
        }

        // 8. Batch MERGE in chunks of 50
        const chunkSize = 50;
        for (let i = 0; i < toPrefill.length; i += chunkSize) {
            const chunk = toPrefill.slice(i, i + chunkSize);
            const valuesClauses = chunk.map(
                (_, idx) => `(@op${idx}, CAST(@dt${idx} AS DATE), CAST(@ord${idx} AS DECIMAL(5,2)), @fer${idx}, @per${idx}, CAST(@ban${idx} AS DECIMAL(5,2)))`
            ).join(', ');

            const params: Record<string, any> = {};
            chunk.forEach((item, idx) => {
                params[`op${idx}`] = item.operatore;
                params[`dt${idx}`] = item.data;
                params[`ord${idx}`] = item.ore_ordinarie !== null ? parseFloat(item.ore_ordinarie) : null;
                params[`fer${idx}`] = item.ore_ferie !== null ? item.ore_ferie : null;
                params[`per${idx}`] = item.ore_permesso !== null ? item.ore_permesso : null;
                params[`ban${idx}`] = item.banca_ore !== null ? parseFloat(item.banca_ore) : null;
            });

            const mergeQuery = `
                MERGE presence_hours_distribution AS target
                USING (VALUES ${valuesClauses}) AS source (operatore, data, ore_ordinarie, ore_ferie, ore_permesso, banca_ore)
                ON (target.operatore = source.operatore AND target.data = source.data)
                WHEN MATCHED AND target.ore_ordinarie IS NULL AND target.ore_ferie IS NULL AND target.ore_permesso IS NULL AND target.ore_malattia IS NULL AND target.banca_ore IS NULL THEN
                    UPDATE SET
                        ore_ordinarie = source.ore_ordinarie,
                        ore_ferie = source.ore_ferie,
                        ore_permesso = source.ore_permesso,
                        banca_ore = source.banca_ore,
                        updated_at = SYSDATETIME()
                WHEN NOT MATCHED THEN
                    INSERT (operatore, data, ore_ordinarie, ore_ferie, ore_permesso, banca_ore, created_at, updated_at)
                    VALUES (source.operatore, source.data, source.ore_ordinarie, source.ore_ferie, source.ore_permesso, source.banca_ore, SYSDATETIME(), SYSDATETIME());
            `;

            await queryMSSQL(mergeQuery, params, 'QUOTES');
        }

        return {
            success: true,
            count: toPrefill.length,
            totalCount: toPrefill.length,
            absencesCount,
            partialCount,
            fullCount,
            bancaOreCount,
            dryRun: false,
        };
    } catch (err: any) {
        return {
            success: false,
            error: err.message as string,
            count: 0,
            totalCount: 0,
            absencesCount: 0,
            partialCount: 0,
            fullCount: 0,
            bancaOreCount: 0,
        };
    }
}

