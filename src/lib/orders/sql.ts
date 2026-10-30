/** Small pieces shared by the order queries (server only). */
import type { MSSQL_DB, SqlParams, SqlRunner } from '@/lib/mssql';

/** Name of the Business database, for NetPro queries that join it (cross-database) */
export const businessDb = () => process.env.MSSQL_DATABASE_BUSINESS || 'COOPZANARDI';

/** Whether a row matching `where` exists in `table` (through `run`: queryMSSQL, or a transaction's runner) */
export async function rowExists(run: SqlRunner, table: string, where: string, params: SqlParams, db: MSSQL_DB) {
    return (await run(`SELECT TOP 1 1 AS x FROM ${table} WITH (NOLOCK) WHERE ${where}`, params, db)).recordset.length > 0;
}
