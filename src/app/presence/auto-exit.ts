/**
 * Daily auto-exit, run by the scheduler through /api/auto-exit. Deliberately not a server action file: the browser
 * cannot call it, only that route can (after checking the scheduler's key or the superadmin).
 */

import { errorMessage } from '@/lib/utils';
import { queryMSSQL, type SqlParams } from '@/lib/mssql';
import { APP_CONFIG } from '@/config/constants';
import { suspendActiveExecutionIfAny } from './presence-db';

/**
 * Auto-exit: find all operators with an ENT event today but no EXT event,
 * then create an EXT event at the configured time based on the day of the week.
 * Sunday is always skipped.
 *
 * @param testOperator - Optional: limit to a single operator code (for testing)
 */
export async function runAutoExit(testOperator?: string) {
    try {
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

        // Skip Sundays
        if (dayOfWeek === 0) {
            return { success: true, skipped: true, reason: 'Sunday — no auto-exit', processed: 0 };
        }

        // Pick the correct exit time based on day
        const exitTime = dayOfWeek === 6
            ? APP_CONFIG.PRESENCE.AUTO_EXIT_TIME_SATURDAY
            : APP_CONFIG.PRESENCE.AUTO_EXIT_TIME_WEEKDAY;

        // Format today as YYYY-MM-DD for MSSQL date comparison
        const todayStr = now.toISOString().slice(0, 10);

        const params: SqlParams = { today: todayStr };
        if (testOperator) params.testOperator = testOperator;

        // Find operators whose LAST presence event today is ENT (handles multiple ENT/EXT pairs)
        const operatorWhere = testOperator ? `AND OGGETTO = @testOperator` : '';
        const findQuery = `
            SELECT OGGETTO
            FROM (
                SELECT OGGETTO, EVENTO,
                       ROW_NUMBER() OVER (PARTITION BY OGGETTO ORDER BY ORA_EVENTO DESC) AS rn
                FROM EVENTI WITH (NOLOCK)
                WHERE TASK = 'presenza'
                  AND CAST(ORA_EVENTO AS DATE) = @today
                  ${operatorWhere}
            ) ranked
            WHERE rn = 1 AND EVENTO = 'ENT'
        `;

        const found = await queryMSSQL<{ OGGETTO: string }>(findQuery, params, 'NETPRO');
        const operators: string[] = found.recordset.map((r) => r.OGGETTO);

        if (operators.length === 0) {
            return { success: true, skipped: false, processed: 0, operators: [] };
        }

        // Build the full datetime string for the EXT event: YYYY-MM-DD HH:MM:SS.000
        const oraEvento = `${todayStr} ${exitTime}.000`;

        // Create EXT event and update STATO_FISICO for each operator
        for (const oggetto of operators) {
            await queryMSSQL(
                `INSERT INTO EVENTI (OGGETTO, EVENTO, ORA_EVENTO, TASK, TIPO_OGGETTO, SOURCE, UTENTE, OPERATORE)
                 VALUES (@oggetto, 'EXT', @oraEvento, 'presenza', 'OPE', 'WS', 'AUTO', @oggetto)`,
                { oggetto, oraEvento },
                'NETPRO'
            );
            await queryMSSQL(
                `UPDATE OPERATORI SET STATO_FISICO = 'OUT' WHERE OPERATORE = @oggetto`,
                { oggetto },
                'NETPRO'
            );
            await suspendActiveExecutionIfAny(oggetto, oraEvento);
        }

        return {
            success: true,
            skipped: false,
            processed: operators.length,
            operators,
            exitTime,
            date: todayStr,
        };
    } catch (err) {
        return {
            success: false,
            error: errorMessage(err),
            processed: 0,
        };
    }
}
