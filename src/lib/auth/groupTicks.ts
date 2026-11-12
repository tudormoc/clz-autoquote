/**
 * Utenti: the group ticks of a user whose save is still on its way. Pure.
 *
 * A tick saves the user's whole list of groups. Computed from the list last read, a second tick made before the
 * first was saved and read back did not know of the first and took it back (2026-11-11 review). Here every tick
 * starts from the list the ticks before it asked for. Once all the saves of a user have come back AND the screen
 * shows the list read again (`readBack`), the next tick starts from what is stored: also after a refused save.
 */
export function createGroupTicks() {
    /** Per user: the list asked for by the ticks so far, and how many of their saves are still on their way */
    const held = new Map<number, { groupIds: number[]; saves: number }>();

    return {
        /** The whole list a tick asks for (to save); `stored` is the user's list as the screen shows it */
        tick(userId: number, stored: readonly number[], groupId: number, member: boolean): number[] {
            const before = held.get(userId);
            const from = before?.groupIds ?? stored;
            const groupIds = member ? [...from.filter((id) => id !== groupId), groupId] : from.filter((id) => id !== groupId);
            held.set(userId, { groupIds, saves: (before?.saves ?? 0) + 1 });
            return groupIds;
        },
        /** A save of that user came back, saved or refused */
        settled(userId: number): void {
            const now = held.get(userId);
            if (now) held.set(userId, { ...now, saves: Math.max(0, now.saves - 1) });
        },
        /** The screen shows the lists read again: users with no save on its way start from what is stored */
        readBack(): void {
            for (const [userId, now] of held) if (now.saves === 0) held.delete(userId);
        },
    };
}
