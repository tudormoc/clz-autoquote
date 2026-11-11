/**
 * Daily auto-exit, run by the scheduler through /api/auto-exit. Deliberately not a server action file: the browser
 * cannot call it, only that route can (after checking the scheduler's key or the superadmin).
 */

import { errorMessage } from '@/lib/utils';
import { queryMSSQL, withTransactions, type SqlParams } from '@/lib/mssql';
import { APP_CONFIG } from '@/config/constants';
import { getTodayDate } from '@/lib/dateUtils';
import { APP_COPY } from '@/locales';
import { PRESENCE_EXIT } from '@/lib/presence';
import { addPresenceEvent, type PausedWork } from './presence-db';

/** Who NetPro shows as the writer of an automatic exit */
const AUTO_EXIT_USER = 'AUTO';

/**
 * Auto-exit: find all operators with an ENT event today but no EXT event,
 * then create an EXT event at the configured time based on the day of the week.
 * Sunday is always skipped. Each operator's writes (work in progress paused, EXT event, stato fisico) are one transaction.
 *
 * @param testOperator - Optional: limit to a single operator code (for testing)
 */
export async function runAutoExit(testOperator?: string) {
    try {
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

        // Skip Sundays
        if (dayOfWeek === 0) {
            return { success: true, skipped: true, reason: APP_COPY.analytics.presence.autoExitSunday, processed: 0 };
        }

        // Pick the correct exit time based on day
        const exitTime = dayOfWeek === 6
            ? APP_CONFIG.PRESENCE.AUTO_EXIT_TIME_SATURDAY
            : APP_CONFIG.PRESENCE.AUTO_EXIT_TIME_WEEKDAY;

        // Format today as YYYY-MM-DD for MSSQL date comparison
        const todayStr = getTodayDate();

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

        // The exit of each operator, written like an exit made in NetPro: the work in progress paused one second
        // before, the EXT row, the operator OUT since the exit (addPresenceEvent). One transaction per operator.
        const exitAt = `${todayStr} ${exitTime}`;
        const paused: Record<string, PausedWork[]> = {};
        for (const oggetto of operators) {
            const written = await withTransactions(['NETPRO'], (run) => addPresenceEvent(run, oggetto, PRESENCE_EXIT, exitAt, AUTO_EXIT_USER));
            if (written.paused.length > 0) paused[oggetto] = written.paused;
        }

        return {
            success: true,
            skipped: false,
            processed: operators.length,
            operators,
            exitTime,
            date: todayStr,
            /** The phases paused, by operator (only who had work in progress) */
            paused,
        };
    } catch (err) {
        return {
            success: false,
            error: errorMessage(err),
            processed: 0,
        };
    }
}
