/**
 * Which presence events may be deleted from Eventi Giornalieri (owner, 2026-11-06): an entry or an exit goes only when
 * the operator did nothing else between that entry and its exit; otherwise the delete is refused. Pure: the server
 * action reads the events and asks here. Examples in `npm run presence:examples`.
 */
import { PRESENCE_ENTRY, PRESENCE_EXIT } from './events';

/** A presence event of one operator, as the rule needs it */
export interface PresenceStamp {
    evento: string;
    /** The stored time, in milliseconds */
    at: number;
    /** NetPro's counter of the events of one instant (a double badge stamp is an entry 0 and an exit 1) */
    progressivo: number;
}

const rank = (evento: string) => (evento === PRESENCE_ENTRY ? 0 : evento === PRESENCE_EXIT ? 1 : 2);

/** The events of one operator in the order they happened: an entry before an exit of the same instant */
export const sortStamps = <T extends PresenceStamp>(stamps: readonly T[]): T[] =>
    [...stamps].sort((a, b) => a.at - b.at || a.progressivo - b.progressivo || rank(a.evento) - rank(b.evento));

export const sameStamp = (a: PresenceStamp, b: PresenceStamp) => a.evento === b.evento && a.at === b.at && a.progressivo === b.progressivo;

/**
 * The presence an event belongs to, both ends included: an entry lasts until the next presence event (its exit; no end
 * when nothing follows), an exit goes back to the entry right before it. null: an exit with no entry before it,
 * which stands alone.
 */
export function presenceSpan(sorted: readonly PresenceStamp[], index: number): { from: number; to: number } | null {
    const stamp = sorted[index];
    if (stamp.evento === PRESENCE_ENTRY) return { from: stamp.at, to: sorted[index + 1]?.at ?? Infinity };
    const previous = sorted[index - 1];
    return stamp.evento === PRESENCE_EXIT && previous?.evento === PRESENCE_ENTRY ? { from: previous.at, to: stamp.at } : null;
}

/**
 * The picked events that must stay: something else of the operator (work started or suspended, a machine) lies
 * inside their presence. `stamps` are the operator's presence events around the picked ones, `otherTimes` the
 * times of everything else the operator did there.
 */
export function blockedStamps<T extends PresenceStamp>(stamps: readonly T[], picked: readonly PresenceStamp[], otherTimes: readonly number[]): T[] {
    const sorted = sortStamps(stamps);
    return sorted.filter((stamp, index) => {
        if (!picked.some((one) => sameStamp(one, stamp))) return false;
        const span = presenceSpan(sorted, index);
        return span !== null && otherTimes.some((time) => time >= span.from && time <= span.to);
    });
}
