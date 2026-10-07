'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
    getColumnDistinctValuesAction,
    getTableDataAction,
    getTablesAction,
    testConnectionsAction,
    type DbColumn,
    type DbConnectionStatus,
    type DbRow,
    type DbValueCount,
    type TableFilter,
} from '@/app/db-actions';
import { APP_CONFIG } from '@/config/constants';
import { notify } from '@/lib/notify';
import type { MSSQL_DB } from '@/lib/mssql';

const EMPTY_FILTER: TableFilter = { column: '', value: '', search: '' };

/** State of the database explorer: connection checks, chosen database and table, its columns / rows and filters. */
export function useDatabaseExplorer() {
    const [db, setDb] = useState<MSSQL_DB>(APP_CONFIG.DATABASES[0]);
    const [connections, setConnections] = useState<Record<MSSQL_DB, DbConnectionStatus> | null>(null);
    const [tables, setTables] = useState<string[]>([]);
    const [table, setTable] = useState<string | null>(null);
    const [data, setData] = useState<{ columns: DbColumn[]; rows: DbRow[] } | null>(null);
    const [filter, setFilter] = useState<TableFilter>(EMPTY_FILTER);
    /** Most frequent values of one column, shown above the rows */
    const [values, setValues] = useState<{ column: string; items: DbValueCount[] } | null>(null);
    const [loading, setLoading] = useState(false);
    // Only the latest request may update the screen
    const requestId = useRef(0);

    useEffect(() => {
        testConnectionsAction().then(setConnections);
    }, []);

    useEffect(() => {
        const id = ++requestId.current;
        setLoading(true);
        setTables([]);
        setTable(null);
        setData(null);
        setValues(null);
        getTablesAction(db).then((res) => {
            if (id !== requestId.current) return;
            if (res.success) setTables(res.tables);
            else notify.failure(res.error);
            setLoading(false);
        });
    }, [db]);

    const openTable = useCallback(
        async (name: string, nextFilter: TableFilter = EMPTY_FILTER) => {
            const id = ++requestId.current;
            setTable(name);
            setFilter(nextFilter);
            setValues(null);
            setLoading(true);
            const res = await getTableDataAction(db, name, nextFilter);
            if (id !== requestId.current) return;
            if (res.success) setData({ columns: res.columns, rows: res.rows });
            else notify.failure(res.error);
            setLoading(false);
        },
        [db]
    );

    const showValues = useCallback(
        async (column: string) => {
            if (!table) return;
            const id = ++requestId.current;
            setLoading(true);
            const res = await getColumnDistinctValuesAction(db, table, column);
            if (id !== requestId.current) return;
            if (res.success) setValues({ column, items: res.values });
            else notify.failure(res.error);
            setLoading(false);
        },
        [db, table]
    );

    return {
        db,
        setDb,
        connections,
        tables,
        table,
        data,
        filter,
        setFilter,
        values,
        closeValues: () => setValues(null),
        loading,
        openTable,
        /** Reload the open table with the filters as typed */
        applyFilter: () => table && openTable(table, filter),
        /** Reload the open table keeping only rows where the values' column equals `value` */
        filterByValue: (value: string) => table && values && openTable(table, { ...filter, column: values.column, value }),
        showValues,
    };
}

export type DatabaseExplorerState = ReturnType<typeof useDatabaseExplorer>;
