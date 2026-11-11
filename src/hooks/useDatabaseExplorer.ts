'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useAddress } from '@/hooks/useAddress';
import { choiceParam, textParam } from '@/lib/address';
import { notify } from '@/lib/notify';
import type { MSSQL_DB } from '@/lib/mssql';

const EMPTY_FILTER: TableFilter = { column: '', value: '', search: '' };

/** What the page shows, in the address: the database, the open table and the filters applied to it */
const VIEW = {
    db: choiceParam<MSSQL_DB>(APP_CONFIG.DATABASES, APP_CONFIG.DATABASES[0]),
    table: textParam(),
    column: textParam(),
    value: textParam(),
    search: textParam(),
};

/**
 * State of the database explorer: connection checks, the chosen database and table (in the address, so a table has
 * its own link), its columns / rows, and the filters: typed here, applied in the address.
 */
export function useDatabaseExplorer() {
    const view = useAddress(VIEW);
    const { db } = view.values;
    const table = view.values.table || null;
    const { column, value, search } = view.values;
    const applied = useMemo<TableFilter>(() => ({ column, value, search }), [column, value, search]);

    const [connections, setConnections] = useState<Record<MSSQL_DB, DbConnectionStatus> | null>(null);
    const [tables, setTables] = useState<string[]>([]);
    const [data, setData] = useState<{ columns: DbColumn[]; rows: DbRow[] } | null>(null);
    /** The filters as typed; "Applica" puts them in the address */
    const [filter, setFilter] = useState<TableFilter>(applied);
    /** Most frequent values of one column, shown above the rows */
    const [values, setValues] = useState<{ column: string; items: DbValueCount[] } | null>(null);
    const [listLoading, setListLoading] = useState(false);
    const [dataLoading, setDataLoading] = useState(false);
    /** Goes up when "Applica" is pressed on the filters already applied: the table is read again */
    const [run, setRun] = useState(0);
    // Only the latest request of each kind may update the screen
    const listRequest = useRef(0);
    const dataRequest = useRef(0);

    // Another address (a table picked, Back, a link): the fields show its filters
    const [shown, setShown] = useState(applied);
    if (shown !== applied) {
        setShown(applied);
        setFilter(applied);
    }

    useEffect(() => {
        testConnectionsAction().then(setConnections);
    }, []);

    useEffect(() => {
        const id = ++listRequest.current;
        setListLoading(true);
        setTables([]);
        getTablesAction(db).then((res) => {
            if (id !== listRequest.current) return;
            if (res.success) setTables(res.tables);
            else notify.failure(res.error);
            setListLoading(false);
        });
    }, [db]);

    useEffect(() => {
        const id = ++dataRequest.current;
        setValues(null);
        if (!table) {
            setData(null);
            setDataLoading(false);
            return;
        }
        setDataLoading(true);
        getTableDataAction(db, table, applied).then((res) => {
            if (id !== dataRequest.current) return;
            if (res.success) setData({ columns: res.columns, rows: res.rows });
            else notify.failure(res.error);
            setDataLoading(false);
        });
    }, [db, table, applied, run]);

    const showValues = useCallback(
        async (ofColumn: string) => {
            if (!table) return;
            const id = ++dataRequest.current;
            setDataLoading(true);
            const res = await getColumnDistinctValuesAction(db, table, ofColumn);
            if (id !== dataRequest.current) return;
            if (res.success) setValues({ column: ofColumn, items: res.values });
            else notify.failure(res.error);
            setDataLoading(false);
        },
        [db, table]
    );

    /** Shows the open table with these filters: a new history step, or the same table read again */
    const applyFilters = (next: TableFilter) => {
        if (next.column === column && next.value === value && next.search === search) setRun((count) => count + 1);
        else view.set(next);
    };

    return {
        db,
        /** The link to a database: its tables, none open */
        dbLink: (name: MSSQL_DB) => view.link({ db: name, table: '', ...EMPTY_FILTER }),
        connections,
        tables,
        table,
        /** The link to a table of the chosen database, without filters */
        tableLink: (name: string) => view.link({ table: name, ...EMPTY_FILTER }),
        data,
        filter,
        setFilter,
        values,
        closeValues: () => setValues(null),
        loading: listLoading || dataLoading,
        /** Reload the open table with the filters as typed */
        applyFilter: () => applyFilters(filter),
        /** Reload the open table keeping only rows where the values' column equals `value` */
        filterByValue: (picked: string) => values && applyFilters({ ...filter, column: values.column, value: picked }),
        showValues,
    };
}

export type DatabaseExplorerState = ReturnType<typeof useDatabaseExplorer>;
