'use client';

import { useCallback, useEffect, useState } from 'react';
import { getAccountsAction, type UserView } from '@/app/access-actions';
import type { Group } from '@/lib/auth/accounts';
import { notify } from '@/lib/notify';
import { errorMessage } from '@/lib/utils';

type Answer = { success: true } | { success: false; error: string };

/**
 * Users and groups for the superadmin's Utenti / Gruppi pages: loaded when the page opens, loaded again after
 * every save, so both pages always show what is stored.
 */
export function useAccounts() {
    const [users, setUsers] = useState<UserView[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const reload = useCallback(async () => {
        try {
            const data = await getAccountsAction();
            setUsers(data.users);
            setGroups(data.groups);
            setError(null);
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        reload();
    }, [reload]);

    /** Runs a save, says how it went (`done` turns a success into a message), reloads; true when saved */
    const run = async <R extends Answer>(save: Promise<R>, done?: (result: R & { success: true }) => string): Promise<boolean> => {
        try {
            const result = await save;
            if (!result.success) {
                notify.error(result.error);
                return false;
            }
            if (done) notify.success(done(result as R & { success: true }));
            return true;
        } catch (err) {
            notify.failure(err);
            return false;
        } finally {
            await reload();
        }
    };

    return { users, groups, loading, error, run };
}
