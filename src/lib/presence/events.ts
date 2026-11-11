/**
 * Presence events and the stato fisico go together: an entry leaves the operator IN, an exit OUT. NetPro's codes, and
 * which event a stato fisico changed by hand on Operatori needs so the events say the same (owner, 2026-11-06:
 * "follow the logic always"). Pure. Examples in `npm run presence:examples`.
 */

/** NetPro's codes of the two presence events */
export const PRESENCE_ENTRY = 'ENT';
export const PRESENCE_EXIT = 'EXT';

/** The stato fisico of who is inside and of who went out */
export const STATO_IN = 'IN';
export const STATO_OUT = 'OUT';

const clean = (value: string | null | undefined) => (value ?? '').trim().toUpperCase();

/** The stato fisico an event leaves the operator in; null for anything that is not an entry or an exit */
export function statoAfterEvent(evento: string): string | null {
    const event = clean(evento);
    return event === PRESENCE_ENTRY ? STATO_IN : event === PRESENCE_EXIT ? STATO_OUT : null;
}

/** true when the change goes into IN or out of IN: the changes that go with an event */
export const isPresenceStatoChange = (from: string | null | undefined, to: string | null | undefined) =>
    clean(from) !== clean(to) && (clean(from) === STATO_IN || clean(to) === STATO_IN);

/**
 * The presence event a stato fisico changed by hand needs, so the events always say the same as the stato. IN is the
 * only stato of who is inside:
 * - into IN (from OUT, from OFF): an entry, unless the operator's last presence event is already an entry;
 * - out of IN (to OUT, to OFF): an exit, when the last presence event is an entry (there is one to close);
 * - any other change (OUT ↔ OFF): none.
 * "Already" and "one to close" keep doubles away when the stato was only left wrong, for example after a deleted event.
 */
export function eventForStatoChange(from: string | null | undefined, to: string | null | undefined, lastEvent: string | null | undefined): string | null {
    if (!isPresenceStatoChange(from, to)) return null;
    const entered = clean(lastEvent) === PRESENCE_ENTRY;
    if (clean(to) === STATO_IN) return entered ? null : PRESENCE_ENTRY;
    return entered ? PRESENCE_EXIT : null;
}
