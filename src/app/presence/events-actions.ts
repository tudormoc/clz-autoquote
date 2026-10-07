'use server'

/** Daily Events: presence events (EVENTI) — list, edit time, add, delete with the events that go with them. */

import { queryMSSQL } from '@/lib/mssql';
import { suspendActiveExecutionIfAny } from './presence-db';

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
