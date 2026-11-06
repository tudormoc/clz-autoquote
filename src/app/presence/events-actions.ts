'use server'

/** Daily Events: presence events (EVENTI) — list, edit the time, add by hand. */

import { errorMessage } from '@/lib/utils';
import { queryMSSQL, withTransactions, type SqlParams } from '@/lib/mssql';
import { APP_COPY, fmt } from '@/locales';
import type { PresenceEventRow } from '@/types';
import { buildOperatorSearch, suspendActiveExecutionIfAny, withMillis } from './presence-db';
import { authorize } from '@/lib/auth/access';
import { LINKS } from '@/config/navigation';
import { logEvent, personOf } from '@/lib/log/log';

/** The lines this file writes in the log (Registro) */
const log = APP_COPY.log.entries;

export async function getDailyEventsAction(dateFrom: string, dateTo: string, operatorFilter?: string) {
    await authorize('view', LINKS.presence.dailyEvents);
    try {
        const conditions: string[] = [
            'EVT.TASK = @task',
            'CAST(EVT.ORA_EVENTO AS DATE) >= @dateFrom',
            'CAST(EVT.ORA_EVENTO AS DATE) <= @dateTo',
        ];
        const params: SqlParams = { task: 'presenza', dateFrom, dateTo };

        const operatorSearch = buildOperatorSearch(operatorFilter, ['EVT.OGGETTO', 'OPE.NOME'], 'operator', params);
        if (operatorSearch) conditions.push(operatorSearch);

        const result = await queryMSSQL<PresenceEventRow>(`
            SELECT
                EVT.OGGETTO,
                OPE.NOME as operator_name,
                EVT.EVENTO,
                EVT.ORA_EVENTO
            FROM EVENTI EVT WITH (NOLOCK)
            LEFT JOIN OPERATORI OPE WITH (NOLOCK) ON EVT.OGGETTO = OPE.OPERATORE
            WHERE ${conditions.join(' AND ')}
            ORDER BY EVT.ORA_EVENTO ASC
        `, params, 'NETPRO');

        return { success: true, data: result.recordset };
    } catch (err) {
        return { success: false, error: errorMessage(err), data: [] as PresenceEventRow[] };
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
    const access = await authorize('edit', LINKS.presence.dailyEvents);
    if (!EVENT_COLUMNS.includes(columnName)) return { success: false, error: APP_COPY.common.notAllowed };
    try {
        // A time is stored as typed (no time zone conversion), with milliseconds
        const queryValue = columnName === 'ORA_EVENTO' ? withMillis(newValue) : newValue;

        // The event is identified by OGGETTO + ORA_EVENTO
        await queryMSSQL(`
            UPDATE EVENTI
            SET ${columnName} = @newValue
            WHERE OGGETTO = @oggetto
              AND ORA_EVENTO = @oraEvento
              AND TASK = 'presenza'
        `, { newValue: queryValue, oggetto, oraEvento }, 'NETPRO');

        await logEvent(personOf(access), {
            page: LINKS.presence.dailyEvents,
            action: 'changed',
            entityKind: 'presence-event',
            entityId: oggetto,
            summary: fmt(log.eventUpdated, { operator: oggetto, column: columnName, value: newValue }),
            details: { event: { operator: oggetto, at: oraEvento }, after: { [columnName]: newValue } },
        });
        return { success: true };
    } catch (err) {
        return { success: false, error: errorMessage(err) };
    }
}

/** "YYYY-MM-DD HH:MM:SS" one second earlier, on the text itself so no time zone can shift it */
function oneSecondBefore(time: string): string {
    const parts = time.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
    if (!parts) throw new Error(`Invalid time format: ${time}`);
    const [, date, hours, minutes, seconds] = parts;
    const total = Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds) - 1;
    const two = (n: number) => String(n).padStart(2, '0');
    return `${date} ${two(Math.floor(total / 3600))}:${two(Math.floor((total % 3600) / 60))}:${two(total % 60)}`;
}

/**
 * Adds a presence event by hand and sets the operator's stato fisico. An exit (EXT) first suspends the task the
 * operator was executing, one second before the exit; everything is one transaction.
 */
export async function createEventAction(oggetto: string, evento: string, oraEvento: string) {
    const access = await authorize('edit', LINKS.presence.dailyEvents);
    try {
        const upperEvt = evento.trim().toUpperCase();
        const time = withMillis(oraEvento);
        const newStatus = upperEvt === 'EXT' ? 'OUT' : upperEvt === 'ENT' ? 'IN' : null;

        await withTransactions(['NETPRO'], async (run) => {
            if (upperEvt === 'EXT') await suspendActiveExecutionIfAny(run, oggetto, oneSecondBefore(oraEvento));

            await run(`
                INSERT INTO EVENTI (OGGETTO, EVENTO, ORA_EVENTO, TASK, TIPO_OGGETTO, SOURCE, UTENTE, OPERATORE)
                VALUES (@oggetto, @evento, @oraEvento, 'presenza', 'OPE', 'WS', 'ADMIN', @oggetto)
            `, { oggetto, evento, oraEvento: time }, 'NETPRO');

            if (newStatus) {
                await run(
                    `UPDATE OPERATORI SET STATO_FISICO = @newStatus, ORA_ST_FISICO = @oraEvento WHERE OPERATORE = @oggetto`,
                    { newStatus, oggetto, oraEvento: time },
                    'NETPRO'
                );
            }
        });

        await logEvent(personOf(access), {
            page: LINKS.presence.dailyEvents,
            action: 'created',
            entityKind: 'presence-event',
            entityId: oggetto,
            summary: fmt(log.eventCreated, { operator: oggetto, event: upperEvt, time: oraEvento }),
            details: { after: { operator: oggetto, event: upperEvt, at: oraEvento, statoFisico: newStatus } },
        });
        return { success: true };
    } catch (err) {
        return { success: false, error: errorMessage(err) };
    }
}
