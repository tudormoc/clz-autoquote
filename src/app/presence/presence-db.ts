/**
 * Database helpers shared by the presence server actions. Not a 'use server' file on purpose:
 * these must not become actions the browser can call.
 */

import { queryMSSQL, type SqlRunner } from '@/lib/mssql';
import type { PresenceSettingRow } from '@/types';
import {
    DEFAULT_PRESENCE_RULES,
    PRESENCE_SETTING_KEYS,
    STATO_IN,
    STATO_OUT,
    parsePresenceRules,
    statoAfterEvent,
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

/** "YYYY-MM-DD HH:MM:SS" one second earlier, on the text itself so no time zone can shift it */
function oneSecondBefore(time: string): string {
    const parts = time.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
    if (!parts) throw new Error(`Invalid time format: ${time}`);
    const [, date, hours, minutes, seconds] = parts;
    const total = Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds) - 1;
    const two = (n: number) => String(n).padStart(2, '0');
    return `${date} ${two(Math.floor(total / 3600))}:${two(Math.floor((total % 3600) / 60))}:${two(total % 60)}`;
}

/** The presence events of one operator (@operator) in EVENTI */
export const PRESENCE_OF = `TASK = 'presenza' AND TIPO_OGGETTO = 'OPE' AND OGGETTO = @operator`;

/** The operator's latest presence event (ENT / EXT); null when there is none */
export async function lastPresenceEvent(run: SqlRunner, operator: string): Promise<string | null> {
    const result = await run<{ EVENTO: string }>(
        `SELECT TOP 1 EVENTO FROM EVENTI WITH (NOLOCK) WHERE ${PRESENCE_OF} ORDER BY ORA_EVENTO DESC, PROGRESSIVO DESC, EVENTO DESC`,
        { operator },
        'NETPRO'
    );
    return result.recordset[0]?.EVENTO ?? null;
}

/** Who NetPro shows as the writer of the rows the app adds by hand */
const APP_USER = 'ADMIN';

/** A phase paused for an operator: the task, its machine, and whether colleagues went on working on it */
export interface PausedWork {
    task: string;
    machine: string | null;
    colleaguesGoOn: boolean;
}

/** What writing a presence event did: the stato fisico it left (null: neither entry nor exit) and the phases it paused */
export interface PresenceEventResult {
    stato: string | null;
    paused: PausedWork[];
}

/**
 * Writes one presence event of an operator the way NetPro's own screen does ("Aggiungi Evento", a stato fisico
 * changed on Operatori, the daily automatic exit), compared with NetPro on 2026-11-11:
 * - an entry: the row of EVENTI, the operator IN, and both its "since" times (fisico and logico) = the entry;
 * - an exit: first the work the operator has in progress is paused, one second before (pauseWorkAtExit), then the row
 *   of EVENTI, the operator OUT and its fisico time = the exit.
 * `time` is "YYYY-MM-DD HH:MM:SS"; `utente` is who NetPro shows as the writer (ADMIN by hand, AUTO the automatic
 * exit); `run` is the caller's transaction, so all of it lands together.
 */
export async function addPresenceEvent(run: SqlRunner, operator: string, evento: string, time: string, utente: string = APP_USER): Promise<PresenceEventResult> {
    const stato = statoAfterEvent(evento);
    const oraEvento = withMillis(time);
    const paused = stato === STATO_OUT ? await pauseWorkAtExit(run, operator, time) : [];

    await run(`
        INSERT INTO EVENTI (OGGETTO, EVENTO, ORA_EVENTO, TASK, TIPO_OGGETTO, SOURCE, UTENTE, OPERATORE)
        VALUES (@operator, @evento, @oraEvento, 'presenza', 'OPE', 'WS', @utente, @operator)
    `, { operator, evento, oraEvento, utente }, 'NETPRO');

    if (stato === STATO_IN) {
        await run(`UPDATE OPERATORI SET STATO_FISICO = @stato, ORA_ST_FISICO = @oraEvento, ORA_ST_LOGICO = @oraEvento WHERE OPERATORE = @operator`, { stato, operator, oraEvento }, 'NETPRO');
    } else if (stato) {
        await run(`UPDATE OPERATORI SET STATO_FISICO = @stato, ORA_ST_FISICO = @oraEvento WHERE OPERATORE = @operator`, { stato, operator, oraEvento }, 'NETPRO');
    }
    return { stato, paused };
}

/** Condition: the latest event of machine @machine on a phase is its start, so the machine is open on that phase */
const machineOpenOn = (task: string) => `
    (SELECT TOP 1 M.EVENTO FROM EVENTI M WITH (NOLOCK)
     WHERE M.TASK = ${task} AND M.TIPO_OGGETTO = 'MAC' AND M.OGGETTO = @machine
     ORDER BY M.ORA_EVENTO DESC, M.PROGRESSIVO DESC) = 'OPN'`;

/**
 * Pauses the work an operator has in progress when the operator leaves, the way NetPro itself does at an exit with a
 * job running (compared on 2026-11-11, row by row, with an exit made in NetPro). The pause is dated one second before
 * the exit.
 *
 * What is in progress is what NetPro's own list says (ATTIVITA: one row per person working now), on a phase NetPro
 * holds in execution (TASKS.STATO EXE) and whose last event of that person is the start. Old events never decide:
 * until 2026-11-06 they did, and an exit set phases closed long before back to SUS.
 *
 * For each such phase:
 * - the person's pause row (OPE SUS) with the fields NetPro fills, and the person off the list (ATTIVITA);
 * - when no colleague is still working on the phase: the machine's pause row (MAC SUS) if the machine is open on it,
 *   the phase and its task in stato SUS with the phase's "last change" time and, unless the machine is still open on
 *   another phase in execution, the machine's state row (stato IDLE) and the machine idle;
 * - when colleagues go on: nothing else, the phase and the machine keep running (NetPro's rule in 99 % of 1,385 of
 *   its own pauses).
 * At the end the operator is idle since the exit. The hours NetPro keeps on the phase (TEFF_LAVORO_*) are left to
 * NetPro, which counts them again at its next pause of the phase: its machine hours could not be reproduced exactly.
 * `exitTime` is "YYYY-MM-DD HH:MM:SS"; `run` is the caller's transaction, so all of it lands with the exit event.
 */
export async function pauseWorkAtExit(run: SqlRunner, operator: string, exitTime: string): Promise<PausedWork[]> {
    const pauseTime = withMillis(oneSecondBefore(exitTime));

    const inProgress = await run<{ TASK: string; MACCHINA: string | null; colleagues: number }>(`
        SELECT A.TASK, S.MACCHINA,
               (SELECT COUNT(*) FROM ATTIVITA C WITH (NOLOCK) WHERE C.TASK = A.TASK AND C.TIPO_OGGETTO = 'OPE' AND C.OPERATORE <> A.OPERATORE) AS colleagues
        FROM ATTIVITA A WITH (NOLOCK)
        JOIN TASKS T WITH (NOLOCK) ON T.TASK = A.TASK AND T.STATO = 'EXE'
        CROSS APPLY (SELECT TOP 1 E.EVENTO, E.MACCHINA FROM EVENTI E WITH (NOLOCK)
                     WHERE E.TASK = A.TASK AND E.TIPO_OGGETTO = 'OPE' AND E.OGGETTO = A.OPERATORE
                     ORDER BY E.ORA_EVENTO DESC, E.PROGRESSIVO DESC) S
        WHERE A.OPERATORE = @operator AND A.TIPO_OGGETTO = 'OPE' AND S.EVENTO = 'OPN'
    `, { operator }, 'NETPRO');

    const paused: PausedWork[] = [];
    for (const { TASK: task, MACCHINA: machine, colleagues } of inProgress.recordset) {
        const colleaguesGoOn = colleagues > 0;
        const part = await run<{ PART_NUMBER: string | null }>(`
            SELECT TOP 1 O.PART_NUMBER
            FROM JOBSET J WITH (NOLOCK)
            INNER JOIN ORDINI O WITH (NOLOCK) ON J.ORDINE = O.ORDINE
            WHERE J.TASK = @task
        `, { task }, 'NETPRO');
        const partNumber = part.recordset[0]?.PART_NUMBER ?? null;

        // A pause row as NetPro writes it: the quantities at 0, never empty
        const pauseEvent = (tipoOggetto: 'MAC' | 'OPE', oggetto: string) =>
            run(`
                INSERT INTO EVENTI (TASK, TIPO_OGGETTO, OGGETTO, EVENTO, ORA_EVENTO, MACCHINA, OPERATORE, PART_NUMBER, SOURCE, UTENTE,
                                    QTA_COMPLETATA, QTA_CONTATA, QTA_SCARTATA, QTA_CONTATA_SCARTI, FALTPNUMB)
                VALUES (@task, @tipoOggetto, @oggetto, 'SUS', @pauseTime, @machine, @operator, @partNumber, 'WS', @utente, 0, 0, 0, 0, '0')
            `, { task, tipoOggetto, oggetto, pauseTime, machine, operator, partNumber, utente: APP_USER }, 'NETPRO');

        if (!colleaguesGoOn && machine) {
            const state = await run<{ isOpen: number; busyElsewhere: number }>(`
                SELECT CASE WHEN ${machineOpenOn('@task')} THEN 1 ELSE 0 END AS isOpen,
                       CASE WHEN EXISTS (SELECT 1 FROM TASKS T2 WITH (NOLOCK) WHERE T2.STATO = 'EXE' AND T2.TASK <> @task AND ${machineOpenOn('T2.TASK')}) THEN 1 ELSE 0 END AS busyElsewhere
            `, { task, machine }, 'NETPRO');
            const { isOpen, busyElsewhere } = state.recordset[0];
            if (isOpen) {
                await pauseEvent('MAC', machine);
                if (!busyElsewhere) {
                    await run(`
                        INSERT INTO EVENTI (TASK, TIPO_OGGETTO, OGGETTO, EVENTO, ORA_EVENTO, MACCHINA, OPERATORE, SOURCE, UTENTE)
                        SELECT 'stato', 'MAC', @machine, 'IDLE', @pauseTime, @machine, @operator, 'WS', @utente
                        WHERE NOT EXISTS (SELECT 1 FROM EVENTI WITH (NOLOCK)
                                          WHERE TASK = 'stato' AND TIPO_OGGETTO = 'MAC' AND OGGETTO = @machine AND EVENTO = 'IDLE' AND ORA_EVENTO = @pauseTime)
                    `, { machine, pauseTime, operator, utente: APP_USER }, 'NETPRO');
                    await run(`UPDATE MACCHINE SET STATO_LOGICO = 'IDLE', ORA_ST_LOGICO = @pauseTime WHERE MACCHINA = @machine`, { machine, pauseTime }, 'NETPRO');
                }
            }
        }
        await pauseEvent('OPE', operator);
        if (!colleaguesGoOn) {
            await run(`UPDATE TASKS SET STATO = 'SUS' WHERE TASK = @task`, { task }, 'NETPRO');
            await run(`UPDATE OPERAZIONI SET STATO = 'SUS', DATA_UPD = @pauseTime WHERE ID_OPER = @task`, { task, pauseTime }, 'NETPRO');
        }
        await run(`DELETE FROM ATTIVITA WHERE TASK = @task AND OPERATORE = @operator AND TIPO_OGGETTO = 'OPE'`, { task, operator }, 'NETPRO');
        paused.push({ task, machine, colleaguesGoOn });
    }

    if (paused.length > 0) {
        await run(`UPDATE OPERATORI SET STATO_LOGICO = 'IDLE', ORA_ST_LOGICO = @exit WHERE OPERATORE = @operator`, { operator, exit: withMillis(exitTime) }, 'NETPRO');
    }
    return paused;
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
