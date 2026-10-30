/**
 * Helpers for syncOrderFromDibaAction (see docs/ORDER_PROCESS.md).
 *
 * New rows are CLONED from an existing row of the same order and only the
 * identity/value columns are overridden, so every column Business/NetPro
 * expects (TIPO, QTA_*, FACTIVE, MACCHINA_ASSEGNATA, ...) is always populated.
 */
import type { MSSQL_DB, SqlParams, SqlRunner } from '@/lib/mssql';

export interface SyncDibaOp {
    riga: number;
    fase: number;
    codlavo: number;
    descr_lavor: string;
    terzista: string;
    codcent: number;
    note: string;
    tesec: number;
}

/** NetPro operation id: order id + fase (min 2 digits), e.g. `H26 0000006740010` + `80`. */
/** Placeholder replaced by the DB server's GETDATE() on insert (JS Date would be sent as UTC, 2h off). */
export const NOW = '__NOW__' as const;

export const netOperId = (netOrdine: string, fase: number) =>
    `${netOrdine}${String(fase).padStart(2, '0')}`;

/** Column overrides for a new NetPro OPERAZIONI / TASKS / JOBSET row. */
export function buildNetProOverrides(op: SyncDibaOp, netOrdine: string, qty: number, now: Date | typeof NOW) {
    const idOper = netOperId(netOrdine, op.fase);
    const centro = String(op.codcent);
    return {
        idOper,
        OPERAZIONI: {
            ORDINE: netOrdine, OPERAZIONE: String(op.fase).padStart(2, '0'), ID_OPER: idOper, SEQUENZA: op.fase,
            DESCRIZIONE: op.descr_lavor, CENTRO_ASSEGNATO: centro, CENTRO_REALE: centro,
            DESCRIZIONE01: op.note ? op.note.slice(0, 100) : null, CENTRO_SUCCESSIVO: null, QTA_BASE: qty, QTA_IMPIEGO: 1, QTA_RICHIESTA: qty, STATO: 'REL',
            DATA_INS: now, DATA_UPD: now,
        },
        TASKS: {
            TASK: idOper, DESCRIZIONE: op.descr_lavor, MACCHINA: centro, MACCHINA_ASSEGNATA: centro,
            QTA_RICHIESTA: qty, STATO: 'REL', DATA_INS: now,
        },
        JOBSET: {
            TASK: idOper, ORDINE: netOrdine, OPERAZIONE: String(op.fase).padStart(2, '0'), ID_OPER: idOper, QTA_RICHIESTA: qty,
        },
    };
}

/** Column overrides for a new Business attivit / assris row (fase chain set by syncFaseChain). */
export function buildBusinessOverrides(op: SyncDibaOp, qty: number) {
    return {
        attivit: {
            at_fase: op.fase, at_codlavo: op.codlavo, at_tempesepr: op.tesec,
            at_qtapr: qty, at_qtaes: 0, at_terzista: op.terzista, at_note: op.note || null, at_cicloriga: op.riga,
            at_sufase: 0,
        },
        assris: { as_fase: op.fase, as_codcent: op.codcent },
    };
}

/** Insert a copy of the first row matching `templateWhere`, with `overrides` applied. */
export async function cloneRowInsert(
    run: SqlRunner,
    db: MSSQL_DB,
    table: string,
    templateWhere: string,
    templateParams: SqlParams,
    overrides: SqlParams,
) {
    const tpl = (await run(
        `SELECT TOP 1 * FROM ${table} WITH (NOLOCK) WHERE ${templateWhere}`, templateParams, db,
    )).recordset[0];
    if (!tpl) throw new Error(`Nessuna riga modello in ${table} da cui clonare il nuovo record`);

    const skip = (await run<{ name: string }>(
        `SELECT name FROM sys.columns
         WHERE object_id = OBJECT_ID(@t)
           AND (is_identity = 1 OR is_computed = 1 OR TYPE_NAME(user_type_id) = 'timestamp')`,
        { t: table }, db,
    )).recordset.map((r) => r.name.toLowerCase());

    const clean = Object.fromEntries(Object.entries(overrides).filter(([, v]) => v !== undefined));
    const row: SqlParams = { ...tpl, ...clean };
    const cols = Object.keys(row).filter(c => !skip.includes(c.toLowerCase()));
    const params: SqlParams = {};
    cols.forEach((c, i) => { if (row[c] !== NOW) params[`p${i}`] = row[c]; });
    await run(
        `INSERT INTO ${table} (${cols.map(c => `[${c}]`).join(',')}) VALUES (${cols.map((c, i) => (row[c] === NOW ? 'GETDATE()' : `@p${i}`)).join(',')})`,
        params, db,
    );
}
