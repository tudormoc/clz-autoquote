'use client';

import { useState } from 'react';
import { deleteEventsAction, getConnectedEventsAction } from '@/app/presence/events-actions';
import { dbDateTimeParts } from '@/lib/dateUtils';
import { formatDbDateTime } from '@/lib/format';
import { notify } from '@/lib/notify';
import { APP_COPY, fmt } from '@/locales';
import type { ConnectedEvent, PresenceEventRow } from '@/types';

const copy = APP_COPY.analytics.dailyEvents.delete;

const timeOf = (value: string) => new Date(value).getTime();
const dayOf = (value: string) => dbDateTimeParts(value)?.date;

/** The entry / exit that pairs with `row` on the same day: the ENT before an EXT, the EXT after an ENT */
function findPartner(row: PresenceEventRow, rows: PresenceEventRow[]): PresenceEventRow | undefined {
    const day = dayOf(row.ORA_EVENTO);
    const time = timeOf(row.ORA_EVENTO);
    const dayEvents = rows
        .filter((event) => event.OGGETTO === row.OGGETTO && dayOf(event.ORA_EVENTO) === day)
        .sort((a, b) => timeOf(a.ORA_EVENTO) - timeOf(b.ORA_EVENTO));

    if (row.EVENTO === 'EXT') return dayEvents.filter((e) => e.EVENTO === 'ENT' && timeOf(e.ORA_EVENTO) <= time).pop();
    if (row.EVENTO === 'ENT') return dayEvents.find((e) => e.EVENTO === 'EXT' && timeOf(e.ORA_EVENTO) >= time);
    return undefined;
}

function describe(task: string, evento: string): string {
    const event = String(evento).trim();
    if (task === 'presenza') return event === 'ENT' ? copy.entry : copy.exit;
    if (task === 'stato') return fmt(copy.machineState, { state: event });
    return fmt(copy.job, { event, task });
}

function toItem(task: string, tipoOggetto: string, oggetto: string, evento: string, oraEvento: string): ConnectedEvent {
    return { label: `${task}  –  ${formatDbDateTime(oraEvento)}  –  ${describe(task, evento)}`, oraEvento, oggetto, task, tipoOggetto, evento };
}

interface PendingDeletion {
    /** Operator of the clicked event: its presence state is recomputed after the delete */
    operator: string;
    items: ConnectedEvent[];
    checked: boolean[];
}

/**
 * Deleting a presence event from Daily Events: collects the events that go with it (its entry/exit partner and the
 * job / machine events in between), lets the user untick some, then deletes the ticked ones.
 */
export function useEventDeletion(onDeleted: () => Promise<void>) {
    const [pending, setPending] = useState<PendingDeletion | null>(null);
    const [deleting, setDeleting] = useState(false);

    const open = async (row: PresenceEventRow, rows: PresenceEventRow[]) => {
        const partner = findPartner(row, rows);
        const res = await getConnectedEventsAction(row.OGGETTO, row.ORA_EVENTO, partner?.ORA_EVENTO);
        const items =
            res.success && res.data
                ? res.data.map((evt: any) => toItem(evt.TASK, evt.TIPO_OGGETTO, evt.OGGETTO, evt.EVENTO, evt.ORA_EVENTO))
                : [row, ...(partner ? [partner] : [])].map((evt) => toItem('presenza', 'OPE', evt.OGGETTO, evt.EVENTO, evt.ORA_EVENTO));
        setPending({ operator: row.OGGETTO, items, checked: items.map(() => true) });
    };

    const toggle = (index: number) =>
        setPending((prev) => prev && { ...prev, checked: prev.checked.map((on, i) => (i === index ? !on : on)) });

    const confirm = async () => {
        if (!pending) return;
        setDeleting(true);
        try {
            const result = await deleteEventsAction(pending.operator, pending.items.filter((_, i) => pending.checked[i]));
            if (result.success) {
                setPending(null);
                await onDeleted();
            } else {
                notify.failure(result.error);
            }
        } finally {
            setDeleting(false);
        }
    };

    return { pending, deleting, open, toggle, confirm, close: () => setPending(null) };
}
