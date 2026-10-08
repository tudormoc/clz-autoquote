/** Small pieces shared by the order queries (server only). */
import { queryMSSQL, type MSSQL_DB, type SqlParams } from '@/lib/mssql';

/** Name of the Business database, for NetPro queries that join it (cross-database) */
export const businessDb = () => process.env.MSSQL_DATABASE_BUSINESS || 'COOPZANARDI';

/** Whether a row matching `where` exists in `table` */
export async function rowExists(table: string, where: string, params: SqlParams, db: MSSQL_DB) {
    return (await queryMSSQL(`SELECT TOP 1 1 AS x FROM ${table} WITH (NOLOCK) WHERE ${where}`, params, db)).recordset.length > 0;
}
