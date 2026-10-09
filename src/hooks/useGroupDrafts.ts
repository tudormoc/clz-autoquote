'use client';

import { useRef, useState } from 'react';
import { APP_CONFIG } from '@/config/constants';
import type { Group } from '@/lib/auth/accounts';
import type { PagePermissions } from '@/lib/auth/permissions';

export type SaveState = 'idle' | 'saving' | 'saved';

/**
 * The groups' pages while they are being clicked (Gruppi): a click shows at once, and each group saves itself a
 * moment after its last click (APP_CONFIG.UI.AUTOSAVE_DELAY_MS), so several quick clicks make one save.
 * `save` reloads the stored groups before it answers; the draft is then dropped and the stored pages are shown.
 */
export function useGroupDrafts(save: (id: number, pages: PagePermissions) => Promise<boolean>) {
    const [drafts, setDrafts] = useState<Record<number, PagePermissions>>({});
    const [state, setState] = useState<SaveState>('idle');
    const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

    const pagesOf = (group: Group) => drafts[group.id] ?? group.pages;

    const change = (id: number, pages: PagePermissions) => {
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

    return { pagesOf, change, state };
}
