'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Result } from '@/app/tasks/results';
import { errorMessage } from '@/lib/utils';

/**
 * Data a page loads from a server action as soon as it opens (Agenda pages: a to-do list, not a report), and again
 * with `reload` after every change. `load` must be stable (useCallback or a module function): another `load` is
 * another thing to show (another month, another task).
 *
 * While another thing loads, the one before stays in `data` with `loading` true again, so a page does not blink at
 * every step; a page where the old thing under the new title would mislead compares what `data` is for with what it
 * asked (Le mie ore: the month). When that load fails, `data` is emptied: the page shows the error, not the thing
 * before. A `reload` that fails keeps `data` (it is still what was asked for) and sets `error`. Only the answer to
 * the latest request counts.
 */
export function useActionData<T extends object>(load: () => Promise<Result<T>>) {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const requestId = useRef(0);

    const read = useCallback(
        async (keep: boolean) => {
            const id = ++requestId.current;
            if (!keep) setLoading(true);
            const failed = (message: string) => {
                setError(message);
                if (!keep) setData(null);
            };
            try {
                const result = await load();
                if (id !== requestId.current) return;
                if (result.success) {
                    setData(result);
                    setError(null);
                } else {
                    failed(result.error);
                }
            } catch (err) {
                if (id === requestId.current) failed(errorMessage(err));
            } finally {
                if (id === requestId.current) setLoading(false);
            }
        },
        [load]
    );

    useEffect(() => {
        void read(false);
    }, [read]);

    /** Reads the same thing again (after a save) */
    const reload = useCallback(() => read(true), [read]);

    return { data, loading, error, reload };
}
