'use server'

/** Daily Events: presence events (EVENTI) — list, edit the time, add by hand, delete. */

import { z } from 'zod';
import { errorMessage } from '@/lib/utils';
import { queryMSSQL, withTransactions, type SqlParams, type SqlRunner } from '@/lib/mssql';
import { APP_COPY, fmt } from '@/locales';
import type { PresenceEventRow } from '@/types';
import { PRESENCE_OF, addPresenceEvent, buildOperatorSearch, withMillis } from './presence-db';
import { authorize } from '@/lib/auth/access';
import { APP_CONFIG } from '@/config/constants';
import { LINKS } from '@/config/navigation';
import { formatDbDateTime } from '@/lib/format';
import { logEvent, personOf } from '@/lib/log/log';
import { blockedStamps, sameStamp, type PresenceStamp } from '@/lib/presence';

/** The lines this file writes in the log (Registro) */
const log = APP_COPY.log.entries;
const copy = APP_COPY.analytics.dailyEvents;

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
                EVT.ORA_EVENTO,
                EVT.PROGRESSIVO
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

/**
 * Adds a presence event by hand and sets the operator's stato fisico. An exit (EXT) first pauses the work the
 * operator has in progress, one second before the exit; everything is one transaction (addPresenceEvent).
 */
export async function createEventAction(oggetto: string, evento: string, oraEvento: string) {
    const access = await authorize('edit', LINKS.presence.dailyEvents);
    try {
        const upperEvt = evento.trim().toUpperCase();
        const written = await withTransactions(['NETPRO'], (run) => addPresenceEvent(run, oggetto, upperEvt, oraEvento));

        await logEvent(personOf(access), {
            page: LINKS.presence.dailyEvents,
            action: 'created',
            entityKind: 'presence-event',
            entityId: oggetto,
            summary: fmt(log.eventCreated, { operator: oggetto, event: upperEvt, time: oraEvento }),
            details: { after: { operator: oggetto, event: upperEvt, at: oraEvento, statoFisico: written.stato, workPaused: written.paused } },
        });
        return { success: true };
    } catch (err) {
        return { success: false, error: errorMessage(err) };
    }
}

/** varchar lengths of the EVENTI columns that name a presence event */
const EVENT_KEY_SIZES = { OGGETTO: 25, EVENTO: 4 } as const;

/** A presence event as the list names it: with TASK 'presenza' and TIPO_OGGETTO 'OPE', the whole key of its row */
const EventKeySchema = z.object({
    oggetto: z.string().min(1).max(EVENT_KEY_SIZES.OGGETTO),
    evento: z.string().min(1).max(EVENT_KEY_SIZES.EVENTO),
    oraEvento: z.date(),
    progressivo: z.number().int().min(0),
});
export type PresenceEventKey = z.infer<typeof EventKeySchema>;
const DeleteEventsSchema = z.array(EventKeySchema).min(1).max(APP_CONFIG.PRESENCE.MAX_EVENTS_DELETED);

/** Everything else an operator did: work on a task, and the machine and stato rows that carry the operator */
const OTHER_OF = `TASK <> 'presenza' AND (OPERATORE = @operator OR (TIPO_OGGETTO = 'OPE' AND OGGETTO = @operator))`;

const stampOf = (key: PresenceEventKey): PresenceStamp => ({ evento: key.evento, at: key.oraEvento.getTime(), progressivo: key.progressivo });

/**
 * The picked events of one operator that must stay (the rule: src/lib/presence/eventDelete.ts). Reads the operator's
 * presence events from the one before the first picked to the one after the last, so every picked event has its
 * neighbours, and the times of whatever else the operator did in that stretch.
 */
async function blockedEvents(run: SqlRunner, operator: string, picked: PresenceEventKey[]): Promise<PresenceEventKey[]> {
    const times = picked.map((key) => key.oraEvento.getTime());
    const first = new Date(Math.min(...times));
    const last = new Date(Math.max(...times));
    const around = await run<{ earlier: Date | null; later: Date | null }>(`
        SELECT (SELECT MAX(ORA_EVENTO) FROM EVENTI WITH (NOLOCK) WHERE ${PRESENCE_OF} AND ORA_EVENTO < @first) AS earlier,
               (SELECT MIN(ORA_EVENTO) FROM EVENTI WITH (NOLOCK) WHERE ${PRESENCE_OF} AND ORA_EVENTO > @last) AS later
    `, { operator, first, last }, 'NETPRO');
    const from = around.recordset[0]?.earlier ?? first;
    const to = around.recordset[0]?.later ?? null;
    // No presence event after the last picked one: the stretch has no end
    const stretch = to ? 'ORA_EVENTO >= @from AND ORA_EVENTO <= @to' : 'ORA_EVENTO >= @from';
    const params: SqlParams = to ? { operator, from, to } : { operator, from };

    const stamps = await run<{ EVENTO: string; ORA_EVENTO: Date; PROGRESSIVO: number }>(
        `SELECT EVENTO, ORA_EVENTO, PROGRESSIVO FROM EVENTI WITH (NOLOCK) WHERE ${PRESENCE_OF} AND ${stretch}`, params, 'NETPRO');
    const others = await run<{ ORA_EVENTO: Date }>(`SELECT ORA_EVENTO FROM EVENTI WITH (NOLOCK) WHERE ${OTHER_OF} AND ${stretch}`, params, 'NETPRO');

    const blocked = blockedStamps(
        stamps.recordset.map((row) => ({ evento: row.EVENTO, at: row.ORA_EVENTO.getTime(), progressivo: Number(row.PROGRESSIVO) })),
        picked.map(stampOf),
        others.recordset.map((row) => row.ORA_EVENTO.getTime())
    );
    return picked.filter((key) => blocked.some((stamp) => sameStamp(stamp, stampOf(key))));
}

/** A deleted row as the log keeps it: every column NetPro had filled */
const filledColumns = (row: Record<string, unknown>) => Object.fromEntries(Object.entries(row).filter(([, value]) => value !== null));

/**
 * Deletes the picked presence events the way NetPro's own screen does (compared on 2026-11-06): only their rows of
 * EVENTI go; the stato fisico stays as it is and the clock rows are NetPro's, which rebuilds them at night.
 * All or nothing, one transaction: when the operator did something else during the presence of a picked event, or a
 * picked event is no longer there, nothing is deleted.
 */
export async function deleteEventsAction(events: PresenceEventKey[]) {
    const access = await authorize('edit', LINKS.presence.dailyEvents);
    const parsed = DeleteEventsSchema.safeParse(events);
    if (!parsed.success) return { success: false, error: APP_COPY.common.invalidData };
    const picked = parsed.data;
    const label = (key: PresenceEventKey) => fmt(copy.delete.event, { operator: key.oggetto, event: key.evento, time: formatDbDateTime(key.oraEvento) });
    try {
        const deleted = await withTransactions(['NETPRO'], async (run) => {
            const blocked: PresenceEventKey[] = [];
            for (const operator of new Set(picked.map((key) => key.oggetto))) {
                blocked.push(...(await blockedEvents(run, operator, picked.filter((key) => key.oggetto === operator))));
            }
            if (blocked.length > 0) throw new Error(fmt(copy.delete.blocked, { list: blocked.map(label).join('; ') }));

            const rows: Record<string, unknown>[] = [];
            for (const key of picked) {
                const gone = await run(`
                    DELETE FROM EVENTI OUTPUT DELETED.*
                    WHERE ${PRESENCE_OF} AND EVENTO = @evento AND ORA_EVENTO = @oraEvento AND PROGRESSIVO = @progressivo
                `, { operator: key.oggetto, evento: key.evento, oraEvento: key.oraEvento, progressivo: key.progressivo }, 'NETPRO');
                if (gone.recordset.length !== 1) throw new Error(fmt(copy.delete.gone, { event: label(key) }));
                rows.push(gone.recordset[0]);
            }
            return rows;
        });

        for (const [index, key] of picked.entries()) {
            await logEvent(personOf(access), {
                page: LINKS.presence.dailyEvents,
                action: 'deleted',
                entityKind: 'presence-event',
                entityId: key.oggetto,
                summary: fmt(log.eventDeleted, { operator: key.oggetto, event: key.evento, time: formatDbDateTime(key.oraEvento) }),
                details: { before: filledColumns(deleted[index]) },
            });
        }
        return { success: true };
    } catch (err) {
        return { success: false, error: errorMessage(err) };
    }
}
