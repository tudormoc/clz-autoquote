'use server'

import { queryMSSQL, MSSQL_DB } from '@/lib/mssql';
import { revalidatePath } from 'next/cache';

/**
 * Generic Update Action
 */
export async function updateRecordAction(
    db: MSSQL_DB,
    tableName: string,
    id: string | number,
    idColumn: string,
    data: Record<string, any>
) {
    try {
        const sets: string[] = [];
        const params: Record<string, any> = { idValue: id };

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

        await queryMSSQL(query, params, db);
        revalidatePath('/admin');
        return { success: true };
    } catch (error: any) {
        console.error(`Update failed for ${tableName}:`, error);
        return { success: false, error: error.message };
    }
}

/**
 * Generic Delete Action
 */
export async function deleteRecordAction(
    db: MSSQL_DB,
    tableName: string,
    id: string | number,
    idColumn: string
) {
    try {
        const query = `DELETE FROM ${tableName} WHERE ${idColumn} = @idValue`;
        await queryMSSQL(query, { idValue: id }, db);
        revalidatePath('/admin');
        return { success: true };
    } catch (error: any) {
        console.error(`Delete failed for ${tableName}:`, error);
        return { success: false, error: error.message };
    }
}

/**
 * Generic Insert Action
 */
export async function insertRecordAction(
    db: MSSQL_DB,
    tableName: string,
    data: Record<string, any>
) {
    try {
        const columns = Object.keys(data).join(', ');
        const values = Object.keys(data).map(key => `@${key}`).join(', ');

        const query = `
            INSERT INTO ${tableName} (${columns})
            VALUES (${values})
        `;

        await queryMSSQL(query, data, db);
        revalidatePath('/admin');
        return { success: true };
    } catch (error: any) {
        console.error(`Insert failed for ${tableName}:`, error);
        return { success: false, error: error.message };
    }
}
