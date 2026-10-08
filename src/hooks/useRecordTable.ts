'use client';

import { useCallback, useEffect, useState } from 'react';
import { deleteRecordAction, insertRecordAction, updateRecordAction } from '@/app/admin-actions';
import type { RecordColumn, RecordTableConfig } from '@/components/admin/record-editor/types';
import { confirmDelete } from '@/lib/confirm';
import { notify } from '@/lib/notify';
import { errorMessage } from '@/lib/utils';

type Saved = { success: boolean; error?: string };

/** Rows of a settings table and the writes on them (one value, delete, add), each followed by a reload. */
export function useRecordTable<T extends object>(config: RecordTableConfig<T>) {
    const [rows, setRows] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const reload = useCallback(async () => {
        try {
            setRows(await config.load());
            setError(null);
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setLoading(false);
        }
    }, [config]);

    useEffect(() => {
        reload();
    }, [reload]);

    /** Runs a write; reloads when it worked, tells the user when it did not (also when the server cannot be reached) */
    const finish = useCallback(
        async (write: Promise<Saved>) => {
            try {
                const res = await write;
                if (res.success) await reload();
                else notify.failure(res.error);
                return res.success;
            } catch (err) {
                notify.failure(err);
                return false;
            }
        },
        [reload]
    );

    return {
        rows,
        loading,
        error,
        /** Saves one value of a row; true when saved */
        update: (row: T, column: RecordColumn<T>, value: unknown) => {
            const { table, idKey } = column.storedIn ?? { table: config.table, idKey: 'id' };
            const id = (row as Record<string, unknown>)[idKey] as string | number;
            return finish(updateRecordAction(config.db, table, id, 'id', { [column.key]: value }));
        },
        remove: async (row: T) => {
            if (!(await confirmDelete(config.deleteConfirm))) return false;
            const id = (row as Record<string, unknown>).id as string | number;
            return finish(config.remove ? config.remove(row) : deleteRecordAction(config.db, config.table, id, 'id'));
        },
        add: (values: Record<string, unknown>) => {
            const record = { ...values, ...config.add.extras?.() };
            return finish(config.add.create ? config.add.create(record) : insertRecordAction(config.db, config.table, record));
        },
    };
}
