/**
 * Everything Business and NetPro store about one commessa (one edition), row by row, and the difference between two
 * such snapshots. Riallinea takes one before and one after to log exactly which rows and columns it changed
 * (order-operations-queries.ts); scripts/order-snapshot.ts uses the same list to study what the programs do by
 * themselves. Read queries only (server).
 */
import { BUSINESS_COMPANY } from '@/config/constants';
import type { SqlRunner } from '@/lib/mssql';

export type SnapshotRow = Record<string, unknown>;

export interface SnapshotTable {
    db: 'BUSINESS' | 'NETPRO';
    name: string;
    /** Columns that identify a row (shown in the diff) */
    key: string[];
    /** SELECT with @commessa (a number in Business, text in NetPro) */
    sql: string;
    /** NetPro's bridge log tables (FX*): only the script reads them, the app never writes there */
    bridge?: boolean;
}

/** Rows of every table, by table name */
export type OrderSnapshot = Record<string, SnapshotRow[]>;

/** One row that differs between two snapshots */
export interface RowChange {
    db: 'BUSINESS' | 'NETPRO';
    table: string;
    /** The row's key values, joined with "/" */
    key: string;
    change: 'added' | 'removed' | 'changed';
    /** changed: column → [before, after] */
    columns?: Record<string, [string, string]>;
    /** added / removed: the whole row, so nothing is lost */
    row?: SnapshotRow;
}

const COMPANY = `codditt = '${BUSINESS_COMPANY}'`;
/** The Business rows of the commessa that a dependent table (header, phases) belongs to */
const ofCommessaRow = (alias: string, prefix: string, withRiga: boolean) =>
    `EXISTS (SELECT 1 FROM movord m WITH (NOLOCK) WHERE m.codditt = ${alias}.codditt AND m.mo_tipork = ${alias}.${prefix}_tipork
       AND m.mo_anno = ${alias}.${prefix}_anno AND m.mo_numord = ${alias}.${prefix}_numord${withRiga ? ` AND m.mo_riga = ${alias}.${prefix}_riga` : ''} AND m.mo_commeca = @commessa)`;
const H_ARTICLES = `SELECT mo_codart FROM movord WITH (NOLOCK) WHERE ${COMPANY} AND mo_tipork = 'H' AND mo_commeca = @commessa`;
const NETPRO_ORDERS = `SELECT ORDINE FROM ORDINI WITH (NOLOCK) WHERE COMMESSA = @commessa`;

export const SNAPSHOT_TABLES: SnapshotTable[] = [
    { db: 'BUSINESS', name: 'movord', key: ['mo_tipork', 'mo_anno', 'mo_numord', 'mo_riga'], sql: `SELECT * FROM movord WITH (NOLOCK) WHERE ${COMPANY} AND mo_commeca = @commessa` },
    { db: 'BUSINESS', name: 'testord', key: ['td_tipork', 'td_anno', 'td_numord'], sql: `SELECT t.* FROM testord t WITH (NOLOCK) WHERE t.${COMPANY} AND ${ofCommessaRow('t', 'td', false)}` },
    { db: 'BUSINESS', name: 'attivit', key: ['at_tipork', 'at_anno', 'at_numord', 'at_riga', 'at_fase'], sql: `SELECT a.* FROM attivit a WITH (NOLOCK) WHERE a.${COMPANY} AND ${ofCommessaRow('a', 'at', true)}` },
    { db: 'BUSINESS', name: 'assris', key: ['as_tipork', 'as_anno', 'as_numord', 'as_riga', 'as_fase'], sql: `SELECT a.* FROM assris a WITH (NOLOCK) WHERE a.${COMPANY} AND ${ofCommessaRow('a', 'as', true)}` },
    { db: 'BUSINESS', name: 'keyord', key: ['ko_tipork', 'ko_anno', 'ko_numord', 'ko_riga'], sql: `SELECT * FROM keyord WITH (NOLOCK) WHERE ${COMPANY} AND ko_commeca = @commessa` },
    { db: 'BUSINESS', name: 'commess', key: ['co_comme'], sql: `SELECT * FROM commess WITH (NOLOCK) WHERE ${COMPANY} AND co_comme = @commessa` },
    { db: 'BUSINESS', name: 'cicli', key: ['dd_coddb', 'dd_riga'], sql: `SELECT * FROM cicli WITH (NOLOCK) WHERE ${COMPANY} AND dd_coddb IN (${H_ARTICLES})` },
    { db: 'BUSINESS', name: 'movdis', key: ['md_coddb', 'md_riga'], sql: `SELECT * FROM movdis WITH (NOLOCK) WHERE ${COMPANY} AND md_coddb IN (${H_ARTICLES})` },
    { db: 'BUSINESS', name: 'artico', key: ['ar_codart'], sql: `SELECT * FROM artico WITH (NOLOCK) WHERE ${COMPANY} AND ar_codart IN (${H_ARTICLES})` },
    { db: 'NETPRO', name: 'ORDINI', key: ['ORDINE'], sql: `SELECT * FROM ORDINI WITH (NOLOCK) WHERE COMMESSA = @commessa` },
    { db: 'NETPRO', name: 'OPERAZIONI', key: ['ID_OPER'], sql: `SELECT * FROM OPERAZIONI WITH (NOLOCK) WHERE ORDINE IN (${NETPRO_ORDERS})` },
    { db: 'NETPRO', name: 'JOBSET', key: ['TASK'], sql: `SELECT * FROM JOBSET WITH (NOLOCK) WHERE ORDINE IN (${NETPRO_ORDERS})` },
    { db: 'NETPRO', name: 'TASKS', key: ['TASK'], sql: `SELECT * FROM TASKS WITH (NOLOCK) WHERE TASK IN (SELECT TASK FROM JOBSET WITH (NOLOCK) WHERE ORDINE IN (${NETPRO_ORDERS}))` },
    { db: 'NETPRO', name: 'MATERIALI_ORDINI', key: ['ORDINE', 'SEQUENZA'], sql: `SELECT * FROM MATERIALI_ORDINI WITH (NOLOCK) WHERE ORDINE IN (${NETPRO_ORDERS})` },
    { db: 'NETPRO', name: 'ANAG_MATERIALI', key: ['PART_NUMBER'], sql: `SELECT * FROM ANAG_MATERIALI WITH (NOLOCK) WHERE PART_NUMBER IN (SELECT PART_NUMBER FROM ORDINI WITH (NOLOCK) WHERE COMMESSA = @commessa AND TIPO = 'MAKE')` },
    { db: 'NETPRO', name: 'FXORDERS', key: ['FBATCH', 'FORDER'], bridge: true, sql: `SELECT * FROM FXORDERS WITH (NOLOCK) WHERE FORDER IN (${NETPRO_ORDERS}) OR FEXTORDER IN (${NETPRO_ORDERS})` },
    { db: 'NETPRO', name: 'FXJOBS', key: ['FBATCH', 'FORDER', 'FOPERATN'], bridge: true, sql: `SELECT * FROM FXJOBS WITH (NOLOCK) WHERE FORDER IN (${NETPRO_ORDERS})` },
    { db: 'NETPRO', name: 'FXDEMANDS', key: ['FBATCH', 'FORDER', 'FSEQUENCE'], bridge: true, sql: `SELECT * FROM FXDEMANDS WITH (NOLOCK) WHERE FORDER IN (${NETPRO_ORDERS})` },
    { db: 'NETPRO', name: 'FXJOBSET', key: ['FBATCH', 'FORDER', 'FOPERATN', 'FSEQUENCE'], bridge: true, sql: `SELECT * FROM FXJOBSET WITH (NOLOCK) WHERE FORDER IN (${NETPRO_ORDERS})` },
];

/** A value as compared and shown: dates as ISO text, binary as hex, text without trailing spaces, nothing for NULL */
export function normalizeValue(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toISOString();
    if (Buffer.isBuffer(value)) return value.toString('hex');
    return typeof value === 'string' ? value.trimEnd() : String(value);
}

const keyOf = (row: SnapshotRow, key: string[]) => key.map((column) => normalizeValue(row[column])).join('/');

/** Rows by key (a repeated key gets #2, #3 … so nothing is lost) */
function byKey(rows: SnapshotRow[], key: string[]) {
    const map = new Map<string, SnapshotRow>();
    for (const row of rows) {
        const base = keyOf(row, key);
        let k = base;
        for (let i = 2; map.has(k); i++) k = `${base}#${i}`;
        map.set(k, row);
    }
    return map;
}

/** Reads every table of the commessa (9 digits). `run` is queryMSSQL; the bridge tables only when asked */
export async function snapshotOrder(run: SqlRunner, commessa: string, options: { bridge?: boolean } = {}): Promise<OrderSnapshot> {
    const tables = SNAPSHOT_TABLES.filter((table) => options.bridge || !table.bridge);
    const results = await Promise.all(
        tables.map((table) => run<SnapshotRow>(table.sql, { commessa: table.db === 'BUSINESS' ? Number(commessa) : commessa }, table.db))
    );
    return Object.fromEntries(tables.map((table, index) => [table.name, results[index].recordset]));
}

/** What differs between two snapshots: rows added, removed, and the columns that changed in the others */
export function diffSnapshots(before: OrderSnapshot, after: OrderSnapshot): RowChange[] {
    const changes: RowChange[] = [];
    for (const { db, name: table, key } of SNAPSHOT_TABLES) {
        if (!(table in before) && !(table in after)) continue;
        const old = byKey(before[table] ?? [], key);
        const next = byKey(after[table] ?? [], key);
        for (const [k, row] of next) {
            const previous = old.get(k);
            if (!previous) {
                changes.push({ db, table, key: k, change: 'added', row });
                continue;
            }
            const columns: Record<string, [string, string]> = {};
            for (const column of new Set([...Object.keys(previous), ...Object.keys(row)])) {
                const from = normalizeValue(previous[column]);
                const to = normalizeValue(row[column]);
                if (from !== to) columns[column] = [from, to];
            }
            if (Object.keys(columns).length > 0) changes.push({ db, table, key: k, change: 'changed', columns });
        }
        for (const [k, row] of old) if (!next.has(k)) changes.push({ db, table, key: k, change: 'removed', row });
    }
    return changes;
}
