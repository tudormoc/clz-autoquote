'use client';

import { useRef, useState } from 'react';
import { APP_CONFIG } from '@/config/constants';
import type { Group } from '@/lib/auth/accounts';
import { sameGrants } from '@/lib/auth/lights';
import type { PagePermissions } from '@/lib/auth/permissions';

export type SaveState = 'idle' | 'saving' | 'saved';

/** What a group had before a click: what "Annulla" puts back */
interface Step {
    id: number;
    pages: PagePermissions;
}

/**
 * The groups' pages while they are being clicked (Gruppi): a click shows at once, and each group saves itself a
 * moment after its last click (APP_CONFIG.UI.AUTOSAVE_DELAY_MS), so several quick clicks make one save.
 * `save` reloads the stored groups before it answers; the draft is then dropped and the stored pages are shown.
 * Every click remembers what the group had before (the last APP_CONFIG.UI.UNDO_STEPS, while the page stays open):
 * `undo` puts the latest back, saved the same way, and says which group it was.
 */
export function useGroupDrafts(save: (id: number, pages: PagePermissions) => Promise<boolean>) {
    const [drafts, setDrafts] = useState<Record<number, PagePermissions>>({});
    const [state, setState] = useState<SaveState>('idle');
    const [steps, setSteps] = useState<Step[]>([]);
    const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

    const pagesOf = (group: Group) => drafts[group.id] ?? group.pages;

    /** Shows the pages at once and saves them a moment later */
    const write = (id: number, pages: PagePermissions) => {
        setDrafts((prev) => ({ ...prev, [id]: pages }));
        setState('saving');
        clearTimeout(timers.current.get(id));
        timers.current.set(
            id,
            setTimeout(async () => {
                timers.current.delete(id);
                const saved = await save(id, pages);
                if (timers.current.has(id)) return; // clicked again meanwhile: that save follows
                setDrafts((prev) => {
                    const next = { ...prev };
                    delete next[id];
                    return next;
                });
                if (timers.current.size === 0) setState(saved ? 'saved' : 'idle');
            }, APP_CONFIG.UI.AUTOSAVE_DELAY_MS)
        );
    };

    const change = (group: Group, pages: PagePermissions) => {
        const before = pagesOf(group);
        // "Tutto" on a group that has everything: nothing to save, to log or to take back
        if (sameGrants(before, pages)) return;
        setSteps((prev) => [...prev, { id: group.id, pages: before }].slice(-APP_CONFIG.UI.UNDO_STEPS));
        write(group.id, pages);
    };

    /** Puts back what the last click changed; the id of its group, or null when there is nothing to take back */
    const undo = (): number | null => {
        const last = steps[steps.length - 1];
        if (!last) return null;
        setSteps((prev) => prev.slice(0, -1));
        write(last.id, last.pages);
        return last.id;
    };

    /** A deleted group has nothing left to take back */
    const forget = (id: number) => setSteps((prev) => prev.filter((step) => step.id !== id));

    return { pagesOf, change, undo, forget, canUndo: steps.length > 0, state };
}
