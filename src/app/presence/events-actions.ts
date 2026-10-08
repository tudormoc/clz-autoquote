'use server'

/** Daily Events: presence events (EVENTI) — list, edit the time, add by hand. */

import { errorMessage } from '@/lib/utils';
import { queryMSSQL, type SqlParams } from '@/lib/mssql';
import { APP_COPY } from '@/locales';
import type { PresenceEventRow } from '@/types';
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

        const params: SqlParams = {
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

        const result = await queryMSSQL<PresenceEventRow>(query, params, 'NETPRO');

        return {
            success: true,
            data: result.recordset
        };
    } catch (err) {
        return {
            success: false,
            error: errorMessage(err),
            data: [] as PresenceEventRow[]
        };
    }
}

/** Columns of an event the list may change (the server refuses any other) */
const EVENT_COLUMNS = ['EVENTO', 'ORA_EVENTO'] as const;

export async function updateEventAction(
    oggetto: string,
    /** The event's current time, as read from the database */
    oraEvento: Date,
    columnName: (typeof EVENT_COLUMNS)[number],
    newValue: string
) {
    if (!EVENT_COLUMNS.includes(columnName)) return { success: false, error: APP_COPY.common.notAllowed };
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
    } catch (err) {
        return {
            success: false,
            error: errorMessage(err)
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
    } catch (err) {
        return {
            success: false,
            error: errorMessage(err)
        };
    }
}
