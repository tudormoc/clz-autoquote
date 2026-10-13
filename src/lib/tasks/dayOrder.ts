/**
 * The order of the open cards inside one day of the calendar. Pure. Cards placed by hand (drag up / down, "In cima",
 * "In fondo") keep their place (`dayOrder` 1, 2 …); the others come after them: by time (none last), then the most
 * important, then by title.
 */

interface DayCard {
    id: number;
    dayOrder: number | null;
    dueTime: string | null;
    priority: number;
    title: string;
}

const UNPLACED = Number.MAX_SAFE_INTEGER;

/** Sort comparer of a day's open cards */
export const compareInDay = (a: DayCard, b: DayCard) =>
    (a.dayOrder ?? UNPLACED) - (b.dayOrder ?? UNPLACED) ||
    (a.dueTime ?? '99').localeCompare(b.dueTime ?? '99') ||
    b.priority - a.priority ||
    a.title.localeCompare(b.title);

/** The day's ids with `id` put at `slot`: its place among the others (0 = first; past the end = last) */
export function placeAt(ids: number[], id: number, slot: number): number[] {
    const others = ids.filter((other) => other !== id);
    const at = Math.max(0, Math.min(slot, others.length));
    return [...others.slice(0, at), id, ...others.slice(at)];
}

/** Same ids in the same order */
export const sameOrder = (a: number[], b: number[]) => a.length === b.length && a.every((id, index) => id === b[index]);

/** Sort comparer across days (Da fare): by due date (none last), then as inside a day */
export const compareByDate = (a: DayCard & { dueDate: string | null }, b: DayCard & { dueDate: string | null }) =>
    (a.dueDate ?? '9999-12-31').localeCompare(b.dueDate ?? '9999-12-31') || compareInDay(a, b);

/**
 * Like placeAt, when only some of the day's cards are shown (calendar filters): `slot` counts the shown ones, and the
 * card lands just before the shown card at that place (past the end: just after the last shown one). The hidden
 * cards keep their places.
 */
export function placeAmong(all: number[], shown: number[], id: number, slot: number): number[] {
    const others = shown.filter((other) => other !== id);
    const rest = all.filter((other) => other !== id);
    const at = slot < others.length ? rest.indexOf(others[Math.max(0, slot)]) : others.length > 0 ? rest.indexOf(others[others.length - 1]) + 1 : rest.length;
    return [...rest.slice(0, at), id, ...rest.slice(at)];
}
