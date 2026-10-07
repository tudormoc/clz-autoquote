'use server'

import { APP_CONFIG } from '@/config/constants';
import { queryMSSQL, MSSQL_DB } from '@/lib/mssql';
import { errorMessage } from '@/lib/utils';

const { ROW_LIMIT, VALUES_LIMIT, SEARCH_COLUMNS } = APP_CONFIG.DB_EXPLORER;
const IDENTIFIER = /^[a-zA-Z0-9_]+$/;

export interface DbColumn {
    COLUMN_NAME: string;
    DATA_TYPE: string;
}
export type DbRow = Record<string, unknown>;
export interface DbValueCount {
    value: unknown;
    count: number;
}
export interface DbConnectionStatus {
    ok: boolean;
    error?: string;
}
export interface TableFilter {
    /** Exact match on one column (column + value) */
    column: string;
    value: string;
    /** Text found in any of the first text columns */
    search: string;
}

type Answer<T> = ({ success: true } & T) | { success: false; error: string };

/** Whether each database answers a trivial query */
export async function testConnectionsAction(): Promise<Record<MSSQL_DB, DbConnectionStatus>> {
    const check = async (db: MSSQL_DB): Promise<DbConnectionStatus> => {
        try {
            await queryMSSQL('SELECT 1 AS ok', {}, db);
            return { ok: true };
        } catch (err) {
            return { ok: false, error: errorMessage(err) };
        }
    };
    const entries = await Promise.all(APP_CONFIG.DATABASES.map(async (db) => [db, await check(db)] as const));
    return Object.fromEntries(entries) as Record<MSSQL_DB, DbConnectionStatus>;
}

export async function getTablesAction(db: MSSQL_DB): Promise<Answer<{ tables: string[] }>> {
    try {
        const result = await queryMSSQL<{ TABLE_NAME: string }>(`
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `, {}, db);
        return { success: true, tables: result.recordset.map((r) => r.TABLE_NAME) };
    } catch (err) {
        return { success: false, error: errorMessage(err) };
    }
}

export async function getTableDataAction(
    db: MSSQL_DB,
    tableName: string,
    filter: TableFilter
): Promise<Answer<{ columns: DbColumn[]; rows: DbRow[] }>> {
    try {
        if (!IDENTIFIER.test(tableName)) throw new Error('Invalid table name');

        const columnsRes = await queryMSSQL<DbColumn>(`
            SELECT COLUMN_NAME, DATA_TYPE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = @tableName
        `, { tableName }, db);

        const columns = columnsRes.recordset;
        const params: Record<string, string> = {};
        const whereClauses: string[] = [];

        // 1. Specific column filter (e.g. an_tipo = 'C')
        if (filter.column) {
            whereClauses.push(`${filter.column} = @filterValue`);
            params.filterValue = filter.value;
        }

        // 2. General search in the text columns
        if (filter.search && columns.length > 0) {
            const stringCols = columns
                .filter((c) => c.DATA_TYPE.includes('char') || c.DATA_TYPE.includes('text'))
                .slice(0, SEARCH_COLUMNS)
                .map((c) => `${c.COLUMN_NAME} LIKE @search`)
                .join(' OR ');

            if (stringCols) {
                whereClauses.push(`(${stringCols})`);
                params.search = `%${filter.search}%`;
            }
        }

        const where = whereClauses.length > 0 ? ` WHERE ${whereClauses.join(' AND ')}` : '';
        const data = await queryMSSQL<DbRow>(`SELECT TOP ${ROW_LIMIT} * FROM ${tableName}${where}`, params, db);

        return { success: true, columns, rows: data.recordset };
    } catch (err) {
        return { success: false, error: errorMessage(err) };
    }
}

export async function getColumnDistinctValuesAction(db: MSSQL_DB, tableName: string, columnName: string): Promise<Answer<{ values: DbValueCount[] }>> {
    try {
        if (!IDENTIFIER.test(tableName) || !IDENTIFIER.test(columnName)) {
            throw new Error('Invalid table or column name');
        }

        const result = await queryMSSQL<DbValueCount>(`
            SELECT TOP ${VALUES_LIMIT} ${columnName} as value, COUNT(*) as count
            FROM ${tableName}
            GROUP BY ${columnName}
            ORDER BY count DESC
        `, {}, db);

        return { success: true, values: result.recordset };
    } catch (err) {
        return { success: false, error: errorMessage(err) };
    }
}
