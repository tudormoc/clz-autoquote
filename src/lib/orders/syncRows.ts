/**
 * Helpers for syncOrderFromDibaAction (see docs/ORDER_PROCESS.md).
 *
 * New rows are CLONED from an existing row of the same order and only the
 * identity/value columns are overridden, so every column Business/NetPro
 * expects (TIPO, QTA_*, FACTIVE, MACCHINA_ASSEGNATA, ...) is always populated.
 * The row copied may already be worked on or withdrawn: the copy never carries that (UNTOUCHED below).
 */
import { APP_CONFIG, BUSINESS_COMPANY } from '@/config/constants';
import type { MSSQL_DB, SqlParams, SqlRunner } from '@/lib/mssql';
import { BUSINESS_EMPTY_DATE, EVASO, NOT_EVASO, usedInNetproSql, WITHDRAWN_IN_BUSINESS_SQL } from '@/lib/orders/sql';
import { APP_COPY, fmt } from '@/locales';

const copy = APP_COPY.analytics.orderOperations;

/** A new operation and its task start in the state of one nobody has worked on */
const NEW_STATE = APP_CONFIG.ORDERS.UNSTARTED_OPERATION_STATE;
const NOT_STARTED_FIRST = `CASE WHEN RTRIM(STATO) = '${NEW_STATE}' THEN 0 ELSE 1 END`;

/**
 * What a copy must not carry, for each table a new row is copied in (owner, 2026-11-06). `values`: the columns NetPro
 * and Business fill as a phase is worked or a material withdrawn, with what an untouched row holds; every copy gets
 * them. `order`: untouched rows first (then the lowest row), so the copy is taken from an untouched row when the order
 * has one — a guard for a column not listed here. Read on the open orders and on the rows of 2026 on 2026-11-06
 * (docs/ORDER_PROCESS.md → "A copy carries nothing of the row it copies").
 */
const UNTOUCHED: Record<string, { values: SqlParams; order: string }> = {
    OPERAZIONI: {
        values: { DATA_INIZIO: null, DATA_FINE: null, TEFF_LAVORO_MAC: 0, TEFF_LAVORO_MAN: 0, QTA_COMPLETATA: 0, QUANTITA1: 0, MODIFICATA: null },
        order: `${NOT_STARTED_FIRST}, SEQUENZA`,
    },
    TASKS: {
        values: { DATA_INIZIO: null, DATA_FINE: null, TEFF_LAVORO_MAC: 0, TEFF_LAVORO_MAN: 0, CICLI_CONTATI: 0, CRITICO: null },
        order: `${NOT_STARTED_FIRST}, TASK`,
    },
    JOBSET: {
        values: { TEFF_LAVORO_MAC: 0, TEFF_LAVORO_MAN: 0, QTA_COMPLETATA: 0, QUANTITA1: 0 },
        order: `CASE WHEN ISNULL(TEFF_LAVORO_MAC, 0) = 0 AND ISNULL(TEFF_LAVORO_MAN, 0) = 0 AND ISNULL(QTA_COMPLETATA, 0) = 0 THEN 0 ELSE 1 END, TASK`,
    },
    MATERIALI_ORDINI: {
        values: { QTA_USATA: 0, QTA_PRELEVATA: 0, DATA_PRELIEVO: null },
        order: `${usedInNetproSql('MATERIALI_ORDINI')}, SEQUENZA`,
    },
    attivit: {
        values: { at_qtaes: 0, at_tempesees: 0, at_operattees: 0, at_operesees: 0, at_flevas: NOT_EVASO },
        order: `CASE WHEN ISNULL(at_qtaes, 0) = 0 AND ISNULL(at_flevas, '') <> '${EVASO}' THEN 0 ELSE 1 END, at_fase`,
    },
    movord: {
        values: { mo_coleva: 0, mo_quaeva: 0, mo_flevas: NOT_EVASO },
        order: `${WITHDRAWN_IN_BUSINESS_SQL}, mo_riga`,
    },
};

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
            DESCRIZIONE01: op.note ? op.note.slice(0, 100) : null, CENTRO_SUCCESSIVO: null, QTA_BASE: qty, QTA_IMPIEGO: 1, QTA_RICHIESTA: qty, STATO: NEW_STATE,
            DATA_INS: now, DATA_UPD: now,
        },
        TASKS: {
            TASK: idOper, DESCRIZIONE: op.descr_lavor, MACCHINA: centro, MACCHINA_ASSEGNATA: centro,
            QTA_RICHIESTA: qty, STATO: NEW_STATE, DATA_INS: now,
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
            at_qtapr: qty, at_terzista: op.terzista, at_note: op.note || null, at_cicloriga: op.riga,
            at_sufase: 0,
        },
        assris: { as_fase: op.fase, as_codcent: op.codcent },
    };
}

/**
 * A row of ANOTHER order to copy from, for an order that has no row of its own yet: where to look, which row first,
 * and `identity`, the values that tie a row to its order, read from the order itself and put on the copy.
 */
export interface ForeignCopy {
    where: string;
    params: SqlParams;
    order: string;
    identity: SqlParams;
}

/**
 * The copy cloneRowInsert inserts, without inserting it (read only): a row of `table` matching `templateWhere` — an
 * untouched one when there is one — with the untouched values of the table and then `overrides` put on it. When no
 * row matches and `foreign` is given, the row comes from another order and gets this order's identity first. A column
 * is named whatever its capitals; one the table does not have stops the copy.
 */
export async function copyOfRow(
    run: SqlRunner,
    db: MSSQL_DB,
    table: string,
    templateWhere: string,
    templateParams: SqlParams,
    overrides: SqlParams,
    foreign?: () => Promise<ForeignCopy>,
): Promise<SqlParams> {
    const untouched = UNTOUCHED[table];
    const firstRow = async (where: string, params: SqlParams, order?: string) =>
        (await run(`SELECT TOP 1 * FROM ${table} WITH (NOLOCK) WHERE ${where}${order ? ` ORDER BY ${order}` : ''}`, params, db)).recordset[0];

    let tpl = await firstRow(templateWhere, templateParams, untouched?.order);
    let identity: SqlParams = {};
    if (!tpl && foreign) {
        const other = await foreign();
        tpl = await firstRow(other.where, other.params, other.order);
        identity = other.identity;
    }
    if (!tpl) throw new Error(fmt(copy.syncNoTemplateRow, { table }));

    const columnOf = new Map(Object.keys(tpl).map((name) => [name.toLowerCase(), name]));
    const row: SqlParams = { ...tpl };
    for (const [name, value] of Object.entries({ ...untouched?.values, ...identity, ...overrides })) {
        if (value === undefined) continue;
        const column = columnOf.get(name.toLowerCase());
        if (!column) throw new Error(fmt(copy.syncUnknownColumn, { table, column: name }));
        row[column] = value;
    }
    return row;
}

/** The production order row of an edition (movord tipo H): what its material rows take from it */
interface OrderRowIdentity {
    mo_serie: string;
    mo_numord: number;
    mo_riga: number;
    mo_commeca: number;
    mo_netpid: string;
    mo_datcons: Date;
    mo_datini: Date;
    mo_codart: string;
    mo_codcfam: string | null;
    /** The account on the order's header (testord), kept on the keyord rows */
    td_conto: number | null;
}

/**
 * Where the FIRST material row of an edition is copied from. An order can have no material at all and get one later
 * (owner, 2026-11-06: "it kept the materials none … now I added one back"), and then it has no row of its own to copy.
 * The row comes from another order — an edition of the same Business order first, then the newest order; a row not
 * withdrawn and as Business makes it (planning dates not set) — and gets from its own order row what ties a material
 * row to its order. Read on the 3.565 material rows of 2026 (docs/ORDER_PROCESS.md → "The first material of an
 * order"): apart from the material's own columns (the overrides of syncMaterials) only these change from one order to
 * another, and they always equal the order row's; in NetPro only ORDINE does.
 * Each table asks only when it finds no row of the edition, and the order row is read once.
 */
export function firstMaterialCopies(run: SqlRunner, { anno, numord, rigaPadre }: { anno: number; numord: number; rigaPadre: number }, netOrdine: string) {
    let reading: Promise<OrderRowIdentity> | undefined;
    const orderRow = () => (reading ??= (async () => {
        const row = (await run<OrderRowIdentity>(`
                SELECT h.mo_serie, h.mo_numord, h.mo_riga, h.mo_commeca, h.mo_netpid, h.mo_datcons, h.mo_datini, h.mo_codart, h.mo_codcfam, t.td_conto
                FROM movord h WITH (NOLOCK)
                LEFT JOIN testord t WITH (NOLOCK) ON t.codditt = h.codditt AND t.td_tipork = h.mo_tipork AND t.td_anno = h.mo_anno
                    AND t.td_serie = h.mo_serie AND t.td_numord = h.mo_numord
                WHERE h.codditt = '${BUSINESS_COMPANY}' AND h.mo_tipork = 'H' AND h.mo_anno = @anno AND h.mo_numord = @numord AND h.mo_riga = @rigaPadre
            `, { anno, numord, rigaPadre }, 'BUSINESS')).recordset[0];
        if (!row) throw new Error(fmt(copy.syncNoTemplateRow, { table: 'movord' }));
        return row;
    })());
    // Another edition of the same Business order is the closest relative; then the newest order
    const sameOrderFirst = (column: string) => `CASE WHEN ${column} = @numord THEN 0 ELSE 1 END`;

    return {
        movord: async (): Promise<ForeignCopy> => {
            const h = await orderRow();
            return {
                where: `codditt = '${BUSINESS_COMPANY}' AND mo_tipork = 'Y' AND mo_anno = @anno AND mo_serie = @serie`,
                params: { anno, numord, serie: h.mo_serie },
                order: `${sameOrderFirst('mo_numord')}, ${WITHDRAWN_IN_BUSINESS_SQL}, CASE WHEN mo_dtpianini <= '${BUSINESS_EMPTY_DATE}' THEN 0 ELSE 1 END, mo_numord DESC, mo_riga`,
                identity: {
                    mo_numord: h.mo_numord, mo_numordor: h.mo_numord, mo_rigaor: h.mo_riga, mo_commeca: h.mo_commeca, mo_netpid: h.mo_netpid,
                    mo_datcons: h.mo_datcons, mo_datconsor: h.mo_datcons, mo_datini: h.mo_datini, mo_datfin: h.mo_datini,
                    mo_disbasp: h.mo_codart, mo_codcfam: h.mo_codcfam,
                },
            };
        },
        keyord: async (): Promise<ForeignCopy> => {
            const h = await orderRow();
            return {
                where: `codditt = '${BUSINESS_COMPANY}' AND ko_tipork = 'Y' AND ko_anno = @anno AND ko_serie = @serie`,
                params: { anno, numord, serie: h.mo_serie },
                order: `${sameOrderFirst('ko_numord')}, ko_numord DESC, ko_riga`,
                identity: { ko_numord: h.mo_numord, ko_commeca: h.mo_commeca, ko_datcons: h.mo_datcons, ko_conto: h.td_conto ?? undefined },
            };
        },
        // NetPro: the rows of the production orders of the same year (the id starts with H and the year)
        netpro: async (): Promise<ForeignCopy> => ({
            where: `ORDINE LIKE @sameYear`,
            params: { sameYear: `${netOrdine.slice(0, 3)}%` },
            order: `${usedInNetproSql('MATERIALI_ORDINI')}, ORDINE DESC, SEQUENZA`,
            identity: { ORDINE: netOrdine },
        }),
    };
}

/** Insert a copy of a row matching `templateWhere` (copyOfRow), with `overrides` applied. */
export async function cloneRowInsert(
    run: SqlRunner,
    db: MSSQL_DB,
    table: string,
    templateWhere: string,
    templateParams: SqlParams,
    overrides: SqlParams,
    foreign?: () => Promise<ForeignCopy>,
) {
    const row = await copyOfRow(run, db, table, templateWhere, templateParams, overrides, foreign);

    const skip = (await run<{ name: string }>(
        `SELECT name FROM sys.columns
         WHERE object_id = OBJECT_ID(@t)
           AND (is_identity = 1 OR is_computed = 1 OR TYPE_NAME(user_type_id) = 'timestamp')`,
        { t: table }, db,
    )).recordset.map((r) => r.name.toLowerCase());

    const cols = Object.keys(row).filter(c => !skip.includes(c.toLowerCase()));
    const params: SqlParams = {};
    cols.forEach((c, i) => { if (row[c] !== NOW) params[`p${i}`] = row[c]; });
    await run(
        `INSERT INTO ${table} (${cols.map(c => `[${c}]`).join(',')}) VALUES (${cols.map((c, i) => (row[c] === NOW ? 'GETDATE()' : `@p${i}`)).join(',')})`,
        params, db,
    );
}
