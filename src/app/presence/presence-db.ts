/**
 * Database helpers shared by the presence server actions. Not a 'use server' file on purpose:
 * these must not become actions the browser can call.
 */

import { queryMSSQL, type SqlRunner } from '@/lib/mssql';
import type { PresenceSettingRow } from '@/types';
import {
    DEFAULT_PRESENCE_RULES,
    PRESENCE_SETTING_KEYS,
    parsePresenceRules,
    type ClockDay,
    type PresenceRulesConfig,
    type HourField,
} from '@/lib/presence';

/**
 * Clock-in aggregates of one operator-day from SITUAZIONI (TIPO 'CLCK'), for a query grouped by operator and
 * CAST(SIT.DATA AS DATE): the day, first entry, last exit, number of sessions and their minutes.
 */
export const CLOCK_COLUMNS = `CONVERT(VARCHAR(10), CAST(SIT.DATA AS DATE), 120) AS data,
                CONVERT(VARCHAR(8), MIN(SIT.ORA_INIZIO), 108) AS ora_inizio,
                CONVERT(VARCHAR(8), MAX(SIT.ORA_FINE), 108) AS ora_fine,
                COUNT(*) AS sessioni_count,
                SUM(DATEDIFF(MINUTE, SIT.ORA_INIZIO, SIT.ORA_FINE)) AS minuti_sessioni`;

/** One operator-day of CLOCK_COLUMNS */
export interface ClockRow {
    data: string;
    ora_inizio: string | null;
    ora_fine: string | null;
    sessioni_count: number;
    minuti_sessioni: number | null;
}

/** The clock data the presence rules count from */
export const clockOf = (row: ClockRow): ClockDay => ({
    firstEntry: row.ora_inizio,
    lastExit: row.ora_fine,
    sessions: row.sessioni_count,
    sessionMinutes: row.minuti_sessioni,
});

/** Date-time text for NetPro: "YYYY-MM-DD HH:MM:SS" with milliseconds when missing */
export const withMillis = (time: string) => (time.includes('.') ? time : `${time}.000`);

/**
 * If the operator has a task in execution (an OPN/EXE/... event without a SUS/CLO after it), suspends it at the
 * given time the way NetPro's own screens do: a MAC SUS event and the machine idle (when a machine is involved),
 * an OPE SUS event, the task and operation in stato SUS, the operator idle.
 * `run` is the caller's transaction (withTransactions), so these writes land together with the exit event.
 */
export async function suspendActiveExecutionIfAny(run: SqlRunner, operatorCode: string, exitTimeStr: string) {
    const formattedTime = withMillis(exitTimeStr);

    const open = await run<{ TASK: string; MACCHINA: string | null }>(`
        SELECT TOP 1 EVT.TASK, EVT.MACCHINA
        FROM EVENTI EVT WITH (NOLOCK)
        WHERE EVT.TASK NOT IN ('presenza', 'stato')
          AND EVT.EVENTO IN ('OPN', 'EXE', 'WORK', 'REW', 'REL')
          AND (EVT.OPERATORE = @operatorCode OR (EVT.OGGETTO = @operatorCode AND EVT.TIPO_OGGETTO = 'OPE'))
          AND NOT EXISTS (
              SELECT 1 FROM EVENTI E2 WITH (NOLOCK)
              WHERE E2.TASK = EVT.TASK
                AND (E2.OPERATORE = @operatorCode OR (E2.OGGETTO = @operatorCode AND E2.TIPO_OGGETTO = 'OPE'))
                AND E2.EVENTO IN ('SUS', 'CLO')
                AND E2.ORA_EVENTO > EVT.ORA_EVENTO
          )
        ORDER BY EVT.ORA_EVENTO DESC
    `, { operatorCode }, 'NETPRO');
    const active = open.recordset[0];
    if (!active) return;

    const { TASK: task, MACCHINA: machine } = active;
    const part = await run<{ PART_NUMBER: string | null }>(`
        SELECT TOP 1 O.PART_NUMBER
        FROM JOBSET J WITH (NOLOCK)
        INNER JOIN ORDINI O WITH (NOLOCK) ON J.ORDINE = O.ORDINE
        WHERE J.TASK = @task
    `, { task }, 'NETPRO');
    const partNumber = part.recordset[0]?.PART_NUMBER ?? null;

    const susEvent = (tipoOggetto: 'MAC' | 'OPE', oggetto: string) =>
        run(`
            INSERT INTO EVENTI (TASK, TIPO_OGGETTO, OGGETTO, EVENTO, ORA_EVENTO, MACCHINA, OPERATORE, PART_NUMBER, SOURCE, UTENTE, INFO1, INFO2, INFO3)
            VALUES (@task, @tipoOggetto, @oggetto, 'SUS', @formattedTime, @machine, @operatorCode, @partNumber, 'WS', 'ADMIN', NULL, NULL, NULL)
        `, { task, tipoOggetto, oggetto, formattedTime, machine, operatorCode, partNumber }, 'NETPRO');

    if (machine) {
        await susEvent('MAC', machine);
        await run(`UPDATE MACCHINE SET STATO_LOGICO = 'IDLE', ORA_ST_LOGICO = @formattedTime WHERE MACCHINA = @machine`, { machine, formattedTime }, 'NETPRO');
    }
    await susEvent('OPE', operatorCode);
    await run(`UPDATE TASKS SET STATO = 'SUS' WHERE TASK = @task`, { task }, 'NETPRO');
    await run(`UPDATE OPERAZIONI SET STATO = 'SUS' WHERE ID_OPER = @task`, { task }, 'NETPRO');
    await run(`UPDATE OPERATORI SET STATO_LOGICO = 'IDLE', ORA_ST_LOGICO = @formattedTime WHERE OPERATORE = @operatorCode`, { operatorCode, formattedTime }, 'NETPRO');
}

/**
 * Load the effective presence rules: defaults overridden by NETPRO.VALORI_TABELLE (PRESENZE).
 * Never throws — falls back to DEFAULT_PRESENCE_RULES if the DB is unreachable.
 */
export async function loadPresenceRules(): Promise<PresenceRulesConfig> {
    try {
        const keys = PRESENCE_SETTING_KEYS.map((k) => `'${k}'`).join(',');
        const res = await queryMSSQL<PresenceSettingRow>(
            `SELECT PARAMETRO, VALORE, FVALUE01
             FROM VALORI_TABELLE WITH (NOLOCK)
             WHERE TABELLA = 'PRESENZE' AND PARAMETRO IN (${keys})`,
            {},
            'NETPRO'
        );
        return parsePresenceRules(res.recordset);
    } catch {
        return DEFAULT_PRESENCE_RULES;
    }
}

/** Build `(a LIKE @p0 OR b LIKE @p0 ...)` conditions for a comma-separated operator search. */
export function buildOperatorSearch(
    operatorFilter: string | undefined,
    columns: string[],
    paramPrefix: string,
    params: Record<string, unknown>
): string | null {
    const terms = (operatorFilter ?? '').split(',').map((o) => o.trim()).filter(Boolean);
    if (terms.length === 0) return null;
    const conds = terms.map((term, i) => {
        params[`${paramPrefix}${i}`] = `%${term}%`;
        return `(${columns.map((c) => `${c} LIKE @${paramPrefix}${i}`).join(' OR ')})`;
    });
    return `(${conds.join(' OR ')})`;
}

const DISTRIBUTION_SELECT = `
    SELECT
        operatore,
        CONVERT(VARCHAR(10), data, 120) AS data,
        ore_ordinarie,
        ore_straordinarie,
        ore_ferie,
        causale_ferie,
        ore_permesso,
        causale_permesso,
        ore_malattia,
        banca_ore,
        banca_ore_mese_n1,
        banca_ore_mese_n
    FROM presence_hours_distribution WITH (NOLOCK)
    WHERE data >= @dateFrom AND data <= @dateTo
`;

type DistributionRecord = Partial<Record<HourField | 'causale_ferie' | 'causale_permesso' | 'banca_ore_mese_n1' | 'banca_ore_mese_n', unknown>> & { operatore: string; data: string };

/** Map saved distributions by `operatore_YYYY-MM-DD`. */
export async function loadDistributionMap(dateFrom: string, dateTo: string): Promise<Map<string, DistributionRecord>> {
    const res = await queryMSSQL<DistributionRecord>(DISTRIBUTION_SELECT, { dateFrom, dateTo }, 'QUOTES')
        .catch(() => ({ recordset: [] as DistributionRecord[] }));
    const map = new Map<string, DistributionRecord>();
    for (const d of res.recordset) {
        const dateStr = typeof d.data === 'string' ? d.data.substring(0, 10) : '';
        map.set(`${d.operatore}_${dateStr}`, d);
    }
    return map;
}
