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

/** A new time as the list's editor gives it: "YYYY-MM-DD HH:MM" or "YYYY-MM-DD HH:MM:SS" */
const EVENT_TIME = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]) ([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

/**
 * Changes the time of one presence event (the only thing of an event the list changes). The event is named by its
 * whole key, as the delete does: by operator and time alone, an entry and an exit stamped at the same instant (a
 * double badge) would both move. One row must change: when the event is no longer there as the list showed
 * it, nothing is written or logged and the answer says to reload. The time is stored as typed (no time zone
 * conversion), with milliseconds; the stato fisico and the clock rows are left to NetPro, as before.
 */
export async function updateEventTimeAction(event: PresenceEventKey, newTime: string) {
    const access = await authorize('edit', LINKS.presence.dailyEvents);
    const parsed = EventKeySchema.safeParse(event);
    if (!parsed.success || typeof newTime !== 'string' || !EVENT_TIME.test(newTime)) return { success: false, error: APP_COPY.common.invalidData };
    const key = parsed.data;
    // Always with seconds: a browser may leave ":00" out, and "07:55" with milliseconds added would be no time at all
    const time = newTime.length === 'YYYY-MM-DD HH:MM'.length ? `${newTime}:00` : newTime;
    // The typed time the way the database's own times arrive here (the wall clock, read as UTC): same format in messages
    const typed = new Date(`${time.replace(' ', 'T')}Z`);
    // The time it already has: nothing to write, nothing to log
    if (typed.getTime() === key.oraEvento.getTime()) return { success: true };
    try {
        // The count is asked in the same batch: it is the UPDATE's own, whatever else the table does at a change
        const changed = await queryMSSQL<{ changed: number }>(`
            UPDATE EVENTI SET ORA_EVENTO = @newTime
            WHERE ${PRESENCE_OF} AND EVENTO = @evento AND ORA_EVENTO = @oraEvento AND PROGRESSIVO = @progressivo;
            SELECT @@ROWCOUNT AS changed;
        `, { newTime: withMillis(time), operator: key.oggetto, evento: key.evento, oraEvento: key.oraEvento, progressivo: key.progressivo }, 'NETPRO');
        if (changed.recordset[0]?.changed !== 1) return { success: false, error: fmt(copy.timeGone, { event: eventLabel(key) }) };

        await logEvent(personOf(access), {
            page: LINKS.presence.dailyEvents,
            action: 'changed',
            entityKind: 'presence-event',
            entityId: key.oggetto,
            summary: fmt(log.eventTimeChanged, { operator: key.oggetto, event: key.evento, from: formatDbDateTime(key.oraEvento), time: formatDbDateTime(typed) }),
            details: { event: { operator: key.oggetto, event: key.evento, progressivo: key.progressivo }, before: { ORA_EVENTO: key.oraEvento }, after: { ORA_EVENTO: time } },
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

/** One event in a message: operator, ENT / EXT, date and time */
const eventLabel = (key: PresenceEventKey) => fmt(copy.delete.event, { operator: key.oggetto, event: key.evento, time: formatDbDateTime(key.oraEvento) });

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
    const label = eventLabel;
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
