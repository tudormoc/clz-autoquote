'use client';

import { useCallback, useEffect, useState } from 'react';
import { deleteSettingAction, insertSettingAction, updateSettingAction } from '@/app/admin-actions';
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
            return finish(updateSettingAction(table, id, column.key, value));
        },
        remove: async (row: T) => {
            if (!(await confirmDelete(config.deleteConfirm))) return false;
            const id = (row as Record<string, unknown>).id as string | number;
            return finish(config.remove ? config.remove(row) : deleteSettingAction(config.table, id));
        },
        /** Moves a row one place up (-1) or down (+1); the order column is renumbered 10, 20, 30 … where it changes */
        move: async (row: T, by: -1 | 1) => {
            const key = config.reorder?.key;
            const from = rows.indexOf(row);
            const to = from + by;
            if (!key || from < 0 || to < 0 || to >= rows.length) return false;
            const ordered = [...rows];
            ordered.splice(to, 0, ...ordered.splice(from, 1));
            setRows(ordered);
            const changes = ordered
                .map((item, index) => ({ item, order: (index + 1) * 10 }))
                .filter(({ item, order }) => (item as Record<string, unknown>)[key] !== order);
            for (const { item, order } of changes) {
                const id = (item as Record<string, unknown>).id as string | number;
                const res = await updateSettingAction(config.table, id, key, order).catch((err: unknown) => ({ success: false, error: errorMessage(err) }));
                if (!res.success) {
                    notify.failure(res.error);
                    break;
                }
            }
            await reload();
            return true;
        },
        add: (values: Record<string, unknown>) => {
            // A new row goes to the end of a list kept in order
            const key = config.reorder?.key;
            const last = key ? Math.max(0, ...rows.map((row) => Number((row as Record<string, unknown>)[key]) || 0)) : 0;
            const record = { ...values, ...(key ? { [key]: last + 10 } : {}), ...config.add.extras?.() };
            return finish(config.add.create ? config.add.create(record) : insertSettingAction(config.table, record));
        },
    };
}
