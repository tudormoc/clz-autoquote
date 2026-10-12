'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Result } from '@/app/tasks/results';
import { errorMessage } from '@/lib/utils';

/**
 * Data a page loads from a server action as soon as it opens (Agenda pages: a to-do list, not a report), and again
 * with `reload` after every change. `load` must be stable (useCallback or a module function).
 */
export function useActionData<T extends object>(load: () => Promise<Result<T>>) {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const reload = useCallback(async () => {
        try {
            const result = await load();
            if (result.success) {
                setData(result);
                setError(null);
            } else {
                setError(result.error);
            }
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setLoading(false);
        }
    }, [load]);

    useEffect(() => {
        reload();
    }, [reload]);

    return { data, loading, error, reload };
}
