'use server'

/**
 * Database page (read only). The browser chooses a database, table and column; each name is checked against the
 * database's own list of tables and columns before it goes into the SQL, so nothing else can reach the query.
 */

import { APP_CONFIG } from '@/config/constants';
import { queryMSSQL, MSSQL_DB } from '@/lib/mssql';
import { errorMessage } from '@/lib/utils';
import { APP_COPY } from '@/locales';
import { requireSuperadmin } from '@/lib/auth/access';

const { ROW_LIMIT, VALUES_LIMIT, SEARCH_COLUMNS } = APP_CONFIG.DB_EXPLORER;

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

const isDatabase = (db: string): db is MSSQL_DB => (APP_CONFIG.DATABASES as readonly string[]).includes(db);

/** Columns of a table of the database, in table order; null when `db` is not one of ours or the table does not exist */
async function tableColumns(db: string, table: string): Promise<DbColumn[] | null> {
    if (!isDatabase(db)) return null;
    const result = await queryMSSQL<DbColumn>(`
            SELECT c.COLUMN_NAME, c.DATA_TYPE
            FROM INFORMATION_SCHEMA.COLUMNS c WITH (NOLOCK)
            JOIN INFORMATION_SCHEMA.TABLES t WITH (NOLOCK)
              ON t.TABLE_SCHEMA = c.TABLE_SCHEMA AND t.TABLE_NAME = c.TABLE_NAME AND t.TABLE_TYPE = 'BASE TABLE'
            WHERE c.TABLE_NAME = @table
            ORDER BY c.ORDINAL_POSITION
        `, { table }, db);
    return result.recordset.length > 0 ? result.recordset : null;
}

const unknownName = { success: false as const, error: APP_COPY.database.unknownName };
/** A checked table or column name as SQL: in brackets, with any `]` doubled */
const sqlName = (name: string) => `[${name.replace(/]/g, ']]')}]`;

/** Whether each database answers a trivial query */
export async function testConnectionsAction(): Promise<Record<MSSQL_DB, DbConnectionStatus>> {
    await requireSuperadmin();
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
    await requireSuperadmin();
    try {
        if (!isDatabase(db)) return unknownName;
        const result = await queryMSSQL<{ TABLE_NAME: string }>(`
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES WITH (NOLOCK)
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
    await requireSuperadmin();
    try {
        const columns = await tableColumns(db, tableName);
        if (!columns) return unknownName;
        const isColumn = (name: string) => columns.some((c) => c.COLUMN_NAME === name);
        const params: Record<string, string> = {};
        const whereClauses: string[] = [];

        // 1. Specific column filter (e.g. an_tipo = 'C')
        if (filter.column) {
            if (!isColumn(filter.column)) return unknownName;
            whereClauses.push(`${sqlName(filter.column)} = @filterValue`);
            params.filterValue = filter.value;
        }

        // 2. General search in the text columns
        if (filter.search && columns.length > 0) {
            const stringCols = columns
                .filter((c) => c.DATA_TYPE.includes('char') || c.DATA_TYPE.includes('text'))
                .slice(0, SEARCH_COLUMNS)
                .map((c) => `${sqlName(c.COLUMN_NAME)} LIKE @search`)
                .join(' OR ');

            if (stringCols) {
                whereClauses.push(`(${stringCols})`);
                params.search = `%${filter.search}%`;
            }
        }

        const where = whereClauses.length > 0 ? ` WHERE ${whereClauses.join(' AND ')}` : '';
        const data = await queryMSSQL<DbRow>(`SELECT TOP ${ROW_LIMIT} * FROM ${sqlName(tableName)} WITH (NOLOCK)${where}`, params, db);

        return { success: true, columns, rows: data.recordset };
    } catch (err) {
        return { success: false, error: errorMessage(err) };
    }
}

export async function getColumnDistinctValuesAction(db: MSSQL_DB, tableName: string, columnName: string): Promise<Answer<{ values: DbValueCount[] }>> {
    await requireSuperadmin();
    try {
        const columns = await tableColumns(db, tableName);
        if (!columns?.some((c) => c.COLUMN_NAME === columnName)) return unknownName;

        const result = await queryMSSQL<DbValueCount>(`
            SELECT TOP ${VALUES_LIMIT} ${sqlName(columnName)} as value, COUNT(*) as count
            FROM ${sqlName(tableName)} WITH (NOLOCK)
            GROUP BY ${sqlName(columnName)}
            ORDER BY count DESC
        `, {}, db);

        return { success: true, values: result.recordset };
    } catch (err) {
        return { success: false, error: errorMessage(err) };
    }
}
