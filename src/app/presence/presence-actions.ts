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

export async function deleteEventAction(
    oggetto: string,
    oraEvento: any,
    pairedOraEvento?: string | null
) {
    try {
        const rawOraVal = oraEvento as any;
        const rawOraStr = rawOraVal instanceof Date ? rawOraVal.toISOString() : String(oraEvento);
        const todayStr = rawOraStr.slice(0, 10);

        if (pairedOraEvento) {
            // Delete specifically the selected event AND its paired event
            const deletePairQuery = `
                DELETE FROM EVENTI
                WHERE OGGETTO = @oggetto
                  AND TASK = 'presenza'
                  AND (ORA_EVENTO = @oraEvento OR ORA_EVENTO = @pairedOraEvento)
            `;
            await queryMSSQL(deletePairQuery, { oggetto, oraEvento, pairedOraEvento }, 'NETPRO');
        } else {
            // Delete only single event
            const query = `
                DELETE FROM EVENTI
                WHERE OGGETTO = @oggetto
                  AND ORA_EVENTO = @oraEvento
                  AND TASK = 'presenza'
            `;
            await queryMSSQL(query, { oggetto, oraEvento }, 'NETPRO');
        }

        // Recalculate latest status for operator based on remaining events today
        const latestEventQuery = `
            SELECT TOP 1 EVENTO
            FROM EVENTI WITH (NOLOCK)
            WHERE OGGETTO = @oggetto
              AND TASK = 'presenza'
              AND CAST(ORA_EVENTO AS DATE) = @today
            ORDER BY ORA_EVENTO DESC
        `;
        const latestRes = await queryMSSQL(latestEventQuery, { oggetto, today: todayStr }, 'NETPRO');
        
        let newStatus = 'OUT';
        if (latestRes.recordset.length > 0) {
            const lastEvt = String(latestRes.recordset[0].EVENTO).trim().toUpperCase();
            newStatus = lastEvt === 'ENT' ? 'IN' : 'OUT';
        }

        await queryMSSQL(
            `UPDATE OPERATORI SET STATO_FISICO = @newStatus WHERE OPERATORE = @oggetto`,
            { newStatus, oggetto },
            'NETPRO'
        );

        return {
            success: true,
            message: 'Event deleted and status updated successfully'
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
        const formattedTime = exitTimeStr.includes('.') ? exitTimeStr : `${exitTimeStr}.000`;
        
        // Find the latest active production start event for this operator (exclude 'presenza' and 'stato')
        const latestQuery = `
            SELECT TOP 1 
                EVT.TASK, EVT.TIPO_OGGETTO, EVT.OGGETTO, EVT.EVENTO, EVT.MACCHINA, EVT.OPERATORE, EVT.PART_NUMBER, EVT.INFO1, EVT.INFO2, EVT.INFO3,
                TSK.STATO as TASK_STATO, OPE.STATO_LOGICO as OPERATOR_STATO_LOGICO
            FROM EVENTI EVT WITH (NOLOCK)
            LEFT JOIN TASKS TSK WITH (NOLOCK) ON EVT.TASK = TSK.TASK
            LEFT JOIN OPERATORI OPE WITH (NOLOCK) ON (EVT.OPERATORE = OPE.OPERATORE OR (EVT.OGGETTO = OPE.OPERATORE AND EVT.TIPO_OGGETTO = 'OPE'))
            WHERE EVT.TASK NOT IN ('presenza', 'stato')
              AND EVT.EVENTO IN ('OPN', 'EXE', 'WORK', 'REW', 'REL')
              AND (EVT.OPERATORE = @operatorCode OR (EVT.OGGETTO = @operatorCode AND EVT.TIPO_OGGETTO = 'OPE'))
            ORDER BY EVT.ORA_EVENTO DESC
        `;

        const result = await queryMSSQL(latestQuery, { operatorCode }, 'NETPRO');
        if (!result.recordset || result.recordset.length === 0) {
            return;
        }

        const lastEvent = result.recordset[0];
        const taskStato = String(lastEvent.TASK_STATO || '').trim().toUpperCase();
        const opStatoLogico = String(lastEvent.OPERATOR_STATO_LOGICO || '').trim().toUpperCase();

        const activeStatuses = ['EXE', 'OPN', 'WORK', 'REW', 'REL'];
        const isCurrentlyActive = activeStatuses.includes(taskStato) || opStatoLogico === 'WORK';

        // Only suspend if the operator is currently in an active production task
        if (isCurrentlyActive) {
            const task = lastEvent.TASK;
            const machine = lastEvent.MACCHINA;
            const partNumber = lastEvent.PART_NUMBER || null;
            const info1 = lastEvent.INFO1 || null;
            const info2 = lastEvent.INFO2 || 'NO';
            const info3 = lastEvent.INFO3 || null;

            // 1. Insert SUS event for Operator (TIPO_OGGETTO = 'OPE') on the real job TASK
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

            // 2. Update TASKS table to set task status to 'SUS'
            if (task) {
                await queryMSSQL(`
                    UPDATE TASKS
                    SET STATO = 'SUS'
                    WHERE TASK = @task
                `, { task }, 'NETPRO');
            }

            // 3. Update OPERATORI table to set logical state to 'IDLE'
            await queryMSSQL(`
                UPDATE OPERATORI
                SET STATO_LOGICO = 'IDLE',
                    ORA_ST_LOGICO = @formattedTime
                WHERE OPERATORE = @operatorCode
            `, { operatorCode, formattedTime }, 'NETPRO');

            // 4. Insert SUS event for Machine (TIPO_OGGETTO = 'MAC') on the real job TASK and update MACCHINE table
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

                // 5. Insert IDLE status event for the machine (TASK = 'stato')
                await queryMSSQL(`
                    INSERT INTO EVENTI (
                        TASK, TIPO_OGGETTO, OGGETTO, EVENTO, ORA_EVENTO, 
                        MACCHINA, OPERATORE, SOURCE, UTENTE
                    )
                    VALUES (
                        'stato', 'MAC', @machine, 'IDLE', @formattedTime,
                        @machine, @operatorCode, 'WS', 'ADMIN'
                    )
                `, {
                    machine,
                    formattedTime,
                    operatorCode
                }, 'NETPRO');

                // 6. Update MACCHINE table to set logical state to 'IDLE'
                await queryMSSQL(`
                    UPDATE MACCHINE
                    SET STATO_LOGICO = 'IDLE',
                        ORA_ST_LOGICO = @formattedTime
                    WHERE MACCHINA = @machine
                `, { machine, formattedTime }, 'NETPRO');
            }
        }
    } catch (err) {
        console.error('Error suspending active execution for operator:', operatorCode, err);
    }
}

export async function createEventAction(
    oggetto: string,
    evento: string,
    oraEvento: string
) {
    try {
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
        const upperEvt = evento.trim().toUpperCase();
        const newStatus = upperEvt === 'EXT' ? 'OUT' : (upperEvt === 'ENT' ? 'IN' : null);
        if (newStatus) {
            await queryMSSQL(
                `UPDATE OPERATORI SET STATO_FISICO = @newStatus WHERE OPERATORE = @oggetto`,
                { newStatus, oggetto },
                'NETPRO'
            );
        }

        // If the event is an exit (EXT), suspend any active machine task for this operator
        if (upperEvt === 'EXT') {
            await suspendActiveExecutionIfAny(oggetto, oraEvento);
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

        // Optional single-operator filter (for testing via ?operator=98)
        const operatorClause = testOperator ? 'AND EVT.OGGETTO = @testOperator' : '';
        const params: Record<string, any> = { today: todayStr };
        if (testOperator) params.testOperator = testOperator;

        // Find operators with ENT today but zero EXT today
        const findQuery = `
            SELECT DISTINCT EVT.OGGETTO
            FROM EVENTI EVT WITH (NOLOCK)
            WHERE EVT.TASK = 'presenza'
              AND CAST(EVT.ORA_EVENTO AS DATE) = @today
              AND EVT.EVENTO = 'ENT'
              ${operatorClause}
              AND NOT EXISTS (
                SELECT 1 FROM EVENTI EVT2 WITH (NOLOCK)
                WHERE EVT2.TASK = 'presenza'
                  AND EVT2.OGGETTO = EVT.OGGETTO
                  AND CAST(EVT2.ORA_EVENTO AS DATE) = @today
                  AND EVT2.EVENTO = 'EXT'
              )
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
