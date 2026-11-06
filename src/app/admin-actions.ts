'use server'

/**
 * Writes of the settings tables (Impostazioni). The browser names a table of EDITABLE_TABLES, a row id and values;
 * anything outside that list is refused, so table and column names in the SQL always come from the server.
 * Each write needs "modifica" on the table's settings page.
 */

import { z } from 'zod';
import { editableTable, type EditableTableName } from '@/config/editableTables';
import { authorize } from '@/lib/auth/access';
import { queryMSSQL, type SqlParams } from '@/lib/mssql';
import { errorMessage } from '@/lib/utils';
import { APP_COPY, fmt } from '@/locales';
import { logEvent, personOf } from '@/lib/log/log';

/** The lines this file writes in the log (Registro) */
const log = APP_COPY.log.entries;

type Saved = { success: true } | { success: false; error: string };

const IdSchema = z.union([z.string().min(1), z.number()]);
const ValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const ValuesSchema = z.record(z.string(), ValueSchema);

const refused: Saved = { success: false, error: APP_COPY.common.notAllowed };

/** Runs one write and turns a failure into `{ success: false, error }` */
async function write(what: string, table: string, query: string, params: SqlParams): Promise<Saved> {
    try {
        await queryMSSQL(query, params, 'QUOTES');
        return { success: true };
    } catch (error) {
        console.error(`${what} failed for ${table}:`, error);
        return { success: false, error: errorMessage(error) };
    }
}

/** The row as it is now, for the log (the columns given, or all); null when it is not there or cannot be read */
async function currentRow(table: string, id: string | number, columns = '*'): Promise<Record<string, unknown> | null> {
    try {
        return (await queryMSSQL(`SELECT ${columns} FROM [${table}] WITH (NOLOCK) WHERE id = @id`, { id }, 'QUOTES')).recordset[0] ?? null;
    } catch {
        return null;
    }
}

/** Changes one value of one row */
export async function updateSettingAction(table: EditableTableName, id: string | number, column: string, value: unknown): Promise<Saved> {
    const config = editableTable(table);
    const parsedId = IdSchema.safeParse(id);
    const parsedValue = ValueSchema.safeParse(value);
    if (!config || !config.update.includes(column) || !parsedId.success || !parsedValue.success) return refused;
    const access = await authorize('edit', config.page);

    const before = await currentRow(table, parsedId.data, `[${column}]`);
    const saved = await write('Update', table, `UPDATE [${table}] SET [${column}] = @value WHERE id = @id`, { id: parsedId.data, value: parsedValue.data });
    if (saved.success) {
        await logEvent(personOf(access), {
            page: config.page,
            action: 'changed',
            entityKind: table,
            entityId: parsedId.data,
            summary: fmt(log.settingUpdated, { table, id: parsedId.data, column }),
            details: { before: before ?? {}, after: { [column]: parsedValue.data } },
        });
    }
    return saved;
}

/** Deletes one row of a table whose rows may be deleted */
export async function deleteSettingAction(table: EditableTableName, id: string | number): Promise<Saved> {
    const config = editableTable(table);
    const parsedId = IdSchema.safeParse(id);
    if (!config?.deletable || !parsedId.success) return refused;
    const access = await authorize('edit', config.page);

    const before = await currentRow(table, parsedId.data);
    const saved = await write('Delete', table, `DELETE FROM [${table}] WHERE id = @id`, { id: parsedId.data });
    if (saved.success) {
        await logEvent(personOf(access), { page: config.page, action: 'deleted', entityKind: table, entityId: parsedId.data, summary: fmt(log.settingDeleted, { table, id: parsedId.data }), details: { before } });
    }
    return saved;
}

/** Adds one row with the given columns */
export async function insertSettingAction(table: EditableTableName, values: Record<string, unknown>): Promise<Saved> {
    const config = editableTable(table);
    const parsed = ValuesSchema.safeParse(values);
    if (!config || !parsed.success) return refused;
    const columns = Object.keys(parsed.data);
    if (columns.length === 0 || columns.some((column) => !config.insert.includes(column))) return refused;
    const access = await authorize('edit', config.page);

    // Parameters are numbered (@p0, @p1 ...), so column names never become parameter names
    const params: SqlParams = Object.fromEntries(columns.map((column, i) => [`p${i}`, parsed.data[column]]));
    const query = `INSERT INTO [${table}] (${columns.map((c) => `[${c}]`).join(', ')}) VALUES (${columns.map((_, i) => `@p${i}`).join(', ')})`;
    const saved = await write('Insert', table, query, params);
    if (saved.success) await logEvent(personOf(access), { page: config.page, action: 'created', entityKind: table, summary: fmt(log.settingInserted, { table }), details: { after: parsed.data } });
    return saved;
}
