'use server'

import { queryMSSQL, MSSQL_DB } from '@/lib/mssql';
import { errorMessage } from '@/lib/utils';

type Row = Record<string, unknown>;
type Saved = { success: true } | { success: false; error: string };

/** Runs one write and turns a failure into `{ success: false, error }` */
async function write(what: string, tableName: string, query: string, params: Row, db: MSSQL_DB): Promise<Saved> {
    try {
        await queryMSSQL(query, params, db);
        return { success: true };
    } catch (error) {
        console.error(`${what} failed for ${tableName}:`, error);
        return { success: false, error: errorMessage(error) };
    }
}

/**
 * Generic Update Action
 */
export async function updateRecordAction(db: MSSQL_DB, tableName: string, id: string | number, idColumn: string, data: Row) {
    const sets: string[] = [];
    const params: Row = { idValue: id };

    Object.entries(data).forEach(([key, value]) => {
        if (key !== idColumn) {
            sets.push(`${key} = @${key}`);
            params[key] = value;
        }
    });

    const query = `
            UPDATE ${tableName}
            SET ${sets.join(', ')}
            WHERE ${idColumn} = @idValue
        `;
    return write('Update', tableName, query, params, db);
}

/**
 * Generic Delete Action
 */
export async function deleteRecordAction(db: MSSQL_DB, tableName: string, id: string | number, idColumn: string) {
    return write('Delete', tableName, `DELETE FROM ${tableName} WHERE ${idColumn} = @idValue`, { idValue: id }, db);
}

/**
 * Generic Insert Action
 */
export async function insertRecordAction(db: MSSQL_DB, tableName: string, data: Row) {
    const columns = Object.keys(data).join(', ');
    const values = Object.keys(data).map(key => `@${key}`).join(', ');

    const query = `
            INSERT INTO ${tableName} (${columns})
            VALUES (${values})
        `;
    return write('Insert', tableName, query, data, db);
}
