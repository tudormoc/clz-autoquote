'use server'

import { queryMSSQL, getMSSQLPool, MSSQL_DB } from '@/lib/mssql';

export async function getTablesAction(db: MSSQL_DB = 'BUSINESS') {
    try {
        const result = await queryMSSQL(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `, {}, db);
        return { success: true, tables: result.recordset.map(r => r.TABLE_NAME) };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function getTableDataAction(tableName: string, searchTerm?: string, filterColumn?: string, filterValue?: string, db: MSSQL_DB = 'BUSINESS') {
    try {
        if (!/^[a-zA-Z0-9_]+$/.test(tableName)) throw new Error('Invalid table name');

        const columnsRes = await queryMSSQL(`
            SELECT COLUMN_NAME, DATA_TYPE 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = @tableName
        `, { tableName }, db);

        const columns = columnsRes.recordset;
        let query = `SELECT TOP 100 * FROM ${tableName}`;
        const params: Record<string, any> = { tableName };
        const whereClauses: string[] = [];

        // 1. Specific Column Filter (e.g., an_tipo = 'C')
        if (filterColumn && filterValue !== undefined) {
            whereClauses.push(`${filterColumn} = @filterValue`);
            params.filterValue = filterValue;
        }

        // 2. General Search Term
        if (searchTerm && columns.length > 0) {
            const stringCols = columns
                .filter((c: any) => c.DATA_TYPE.includes('char') || c.DATA_TYPE.includes('text'))
                .slice(0, 10) // Search more columns now
                .map((c: any) => `${c.COLUMN_NAME} LIKE @search`)
                .join(' OR ');

            if (stringCols) {
                whereClauses.push(`(${stringCols})`);
                params.search = `%${searchTerm}%`;
            }
        }

        if (whereClauses.length > 0) {
            query = `SELECT TOP 100 * FROM ${tableName} WHERE ${whereClauses.join(' AND ')}`;
        }

        const data = await queryMSSQL(query, params, db);

        return {
            success: true,
            columns: columns,
            rows: data.recordset
        };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function testConnectionAction(db: MSSQL_DB = 'BUSINESS') {
    try {
        const pool = await getMSSQLPool(db);
        const result = await pool.request().query('SELECT @@VERSION as version');
        return { success: true, version: result.recordset[0].version };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function getColumnDistinctValuesAction(tableName: string, columnName: string, db: MSSQL_DB = 'BUSINESS') {
    try {
        if (!/^[a-zA-Z0-9_]+$/.test(tableName) || !/^[a-zA-Z0-9_]+$/.test(columnName)) {
            throw new Error('Invalid table or column name');
        }

        const result = await queryMSSQL(`
            SELECT TOP 20 ${columnName} as value, COUNT(*) as count
            FROM ${tableName}
            GROUP BY ${columnName}
            ORDER BY count DESC
        `, {}, db);

        return {
            success: true,
            values: result.recordset
        };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}
