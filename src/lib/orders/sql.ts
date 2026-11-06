/** Small pieces shared by the order queries (server only). */
import type { MSSQL_DB, SqlParams, SqlRunner } from '@/lib/mssql';

/** Name of the Business database, for NetPro queries that join it (cross-database) */
export const businessDb = () => process.env.MSSQL_DATABASE_BUSINESS || 'COOPZANARDI';

/**
 * 1 when work is recorded in NetPro on an operation, else 0: SITUAZIONI holds the work rows of a task, JOBSET the tasks
 * of an operation. `idOper` names the operation's id column in the query around it (e.g. `OPER.ID_OPER`).
 */
export const hasWorkSql = (idOper: string) => `CASE WHEN EXISTS (
        SELECT 1 FROM JOBSET WRK_J WITH (NOLOCK) JOIN SITUAZIONI WRK_S WITH (NOLOCK) ON WRK_S.TASK = WRK_J.TASK
        WHERE WRK_J.ID_OPER = ${idOper}) THEN 1 ELSE 0 END`;

/** 1 when Business marks a material row of a production order (movord tipo Y) as withdrawn ("evaso"), in part or in full; else 0 */
export const WITHDRAWN_IN_BUSINESS_SQL = `CASE WHEN ISNULL(mo_quaeva, 0) <> 0 OR mo_flevas = 'S' THEN 1 ELSE 0 END`;

/** 1 when NetPro holds a picked or used quantity on a material row of an order (MATERIALI_ORDINI, named by `alias`); else 0 */
export const usedInNetproSql = (alias: string) => `CASE WHEN ISNULL(${alias}.QTA_PRELEVATA, 0) <> 0 OR ISNULL(${alias}.QTA_USATA, 0) <> 0 THEN 1 ELSE 0 END`;

/** Whether a row matching `where` exists in `table` (through `run`: queryMSSQL, or a transaction's runner) */
export async function rowExists(run: SqlRunner, table: string, where: string, params: SqlParams, db: MSSQL_DB) {
    return (await run(`SELECT TOP 1 1 AS x FROM ${table} WITH (NOLOCK) WHERE ${where}`, params, db)).recordset.length > 0;
}
