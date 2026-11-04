/**
 * Snapshot of everything Business and NetPro store about one commessa (one edition), to see what a change made in
 * the programs touches. Reads only (SELECT … WITH (NOLOCK)); needs .env.local (the database keys).
 *
 *   npm run order:snapshot -- 260999910 before          saves tmp/order-snapshots/260999910-before.json
 *   (change the order in Business or NetPro)
 *   npm run order:snapshot -- 260999910 after           saves …-after.json and prints what changed since the latest other snapshot
 *   npm run order:snapshot -- 260999910 after2 before   compares with "before" instead of the latest
 *
 * Tables: Business movord (every row of the commessa: impegno R, order H, materials Y …), testord (their headers),
 * attivit / assris (the phases of those rows), keyord, commess, cicli / movdis (the DiBa of the H articles);
 * NetPro ORDINI (every order of the commessa), OPERAZIONI, JOBSET, TASKS, MATERIALI_ORDINI and the FX* bridge rows
 * of those orders. See docs/ORDER_PROCESS.md → Quantities.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { BUSINESS_COMPANY } from '@/config/constants';

const ROOT = path.resolve(__dirname, '..');
const SNAPSHOT_DIR = path.join(ROOT, 'tmp', 'order-snapshots');

type Db = 'BUSINESS' | 'NETPRO';
type Row = Record<string, unknown>;

interface TableSpec {
    db: Db;
    name: string;
    /** Columns that identify a row (shown in the diff) */
    key: string[];
    /** SELECT with @commessa (a number in Business, text in NetPro) */
    sql: string;
}

interface Snapshot {
    commessa: string;
    label: string;
    takenAt: string;
    tables: Record<string, Row[]>;
}

const COMPANY = `codditt = '${BUSINESS_COMPANY}'`;
/** The Business rows of the commessa that a dependent table (header, phases) belongs to */
const ofCommessaRow = (alias: string, prefix: string, withRiga: boolean) =>
    `EXISTS (SELECT 1 FROM movord m WITH (NOLOCK) WHERE m.codditt = ${alias}.codditt AND m.mo_tipork = ${alias}.${prefix}_tipork
       AND m.mo_anno = ${alias}.${prefix}_anno AND m.mo_numord = ${alias}.${prefix}_numord${withRiga ? ` AND m.mo_riga = ${alias}.${prefix}_riga` : ''} AND m.mo_commeca = @commessa)`;
const H_ARTICLES = `SELECT mo_codart FROM movord WITH (NOLOCK) WHERE ${COMPANY} AND mo_tipork = 'H' AND mo_commeca = @commessa`;
const NETPRO_ORDERS = `SELECT ORDINE FROM ORDINI WITH (NOLOCK) WHERE COMMESSA = @commessa`;

const TABLES: TableSpec[] = [
    { db: 'BUSINESS', name: 'movord', key: ['mo_tipork', 'mo_anno', 'mo_numord', 'mo_riga'], sql: `SELECT * FROM movord WITH (NOLOCK) WHERE ${COMPANY} AND mo_commeca = @commessa` },
    { db: 'BUSINESS', name: 'testord', key: ['td_tipork', 'td_anno', 'td_numord'], sql: `SELECT t.* FROM testord t WITH (NOLOCK) WHERE t.${COMPANY} AND ${ofCommessaRow('t', 'td', false)}` },
    { db: 'BUSINESS', name: 'attivit', key: ['at_tipork', 'at_anno', 'at_numord', 'at_riga', 'at_fase'], sql: `SELECT a.* FROM attivit a WITH (NOLOCK) WHERE a.${COMPANY} AND ${ofCommessaRow('a', 'at', true)}` },
    { db: 'BUSINESS', name: 'assris', key: ['as_tipork', 'as_anno', 'as_numord', 'as_riga', 'as_fase'], sql: `SELECT a.* FROM assris a WITH (NOLOCK) WHERE a.${COMPANY} AND ${ofCommessaRow('a', 'as', true)}` },
    { db: 'BUSINESS', name: 'keyord', key: ['ko_tipork', 'ko_anno', 'ko_numord', 'ko_riga'], sql: `SELECT * FROM keyord WITH (NOLOCK) WHERE ${COMPANY} AND ko_commeca = @commessa` },
    { db: 'BUSINESS', name: 'commess', key: ['co_comme'], sql: `SELECT * FROM commess WITH (NOLOCK) WHERE ${COMPANY} AND co_comme = @commessa` },
    { db: 'BUSINESS', name: 'cicli', key: ['dd_coddb', 'dd_riga'], sql: `SELECT * FROM cicli WITH (NOLOCK) WHERE ${COMPANY} AND dd_coddb IN (${H_ARTICLES})` },
    { db: 'BUSINESS', name: 'movdis', key: ['md_coddb', 'md_riga'], sql: `SELECT * FROM movdis WITH (NOLOCK) WHERE ${COMPANY} AND md_coddb IN (${H_ARTICLES})` },
    { db: 'NETPRO', name: 'ORDINI', key: ['ORDINE'], sql: `SELECT * FROM ORDINI WITH (NOLOCK) WHERE COMMESSA = @commessa` },
    { db: 'NETPRO', name: 'OPERAZIONI', key: ['ID_OPER'], sql: `SELECT * FROM OPERAZIONI WITH (NOLOCK) WHERE ORDINE IN (${NETPRO_ORDERS})` },
    { db: 'NETPRO', name: 'JOBSET', key: ['TASK'], sql: `SELECT * FROM JOBSET WITH (NOLOCK) WHERE ORDINE IN (${NETPRO_ORDERS})` },
    { db: 'NETPRO', name: 'TASKS', key: ['TASK'], sql: `SELECT * FROM TASKS WITH (NOLOCK) WHERE TASK IN (SELECT TASK FROM JOBSET WITH (NOLOCK) WHERE ORDINE IN (${NETPRO_ORDERS}))` },
    { db: 'NETPRO', name: 'MATERIALI_ORDINI', key: ['ORDINE', 'SEQUENZA'], sql: `SELECT * FROM MATERIALI_ORDINI WITH (NOLOCK) WHERE ORDINE IN (${NETPRO_ORDERS})` },
    { db: 'NETPRO', name: 'FXORDERS', key: ['FBATCH', 'FORDER'], sql: `SELECT * FROM FXORDERS WITH (NOLOCK) WHERE FORDER IN (${NETPRO_ORDERS}) OR FEXTORDER IN (${NETPRO_ORDERS})` },
    { db: 'NETPRO', name: 'FXJOBS', key: ['FBATCH', 'FORDER', 'FOPERATN'], sql: `SELECT * FROM FXJOBS WITH (NOLOCK) WHERE FORDER IN (${NETPRO_ORDERS})` },
    { db: 'NETPRO', name: 'FXDEMANDS', key: ['FBATCH', 'FORDER', 'FSEQUENCE'], sql: `SELECT * FROM FXDEMANDS WITH (NOLOCK) WHERE FORDER IN (${NETPRO_ORDERS})` },
    { db: 'NETPRO', name: 'FXJOBSET', key: ['FBATCH', 'FORDER', 'FOPERATN', 'FSEQUENCE'], sql: `SELECT * FROM FXJOBSET WITH (NOLOCK) WHERE FORDER IN (${NETPRO_ORDERS})` },
];

/** .env.local → process.env (the app itself gets it from Next.js) */
function loadEnv(file: string) {
    if (!fs.existsSync(file)) return;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
        if (!match || line.trim().startsWith('#')) continue;
        const value = match[2].replace(/^(['"])(.*)\1$/, '$2');
        if (process.env[match[1]] === undefined) process.env[match[1]] = value;
    }
}

/** A value as compared and printed: dates as ISO text, text without trailing spaces, nothing for NULL */
const normalize = (value: unknown): string =>
    value instanceof Date ? value.toISOString() : value === null || value === undefined ? '' : typeof value === 'string' ? value.trimEnd() : String(value);
const keyOf = (row: Row, key: string[]) => key.map((column) => normalize(row[column])).join('/');

/** Rows by key (a repeated key gets #2, #3 … so nothing is lost) */
function byKey(rows: Row[], key: string[]) {
    const map = new Map<string, Row>();
    for (const row of rows) {
        const base = keyOf(row, key);
        let k = base;
        for (let i = 2; map.has(k); i++) k = `${base}#${i}`;
        map.set(k, row);
    }
    return map;
}

/** Lines describing what changed in one table: rows added, removed, and the columns that changed in the others */
function diffTable(spec: TableSpec, before: Row[], after: Row[]): string[] {
    const old = byKey(before, spec.key);
    const next = byKey(after, spec.key);
    const lines: string[] = [];
    for (const [k, row] of next) {
        const previous = old.get(k);
        if (!previous) {
            lines.push(`  + ${k}`);
            continue;
        }
        const columns = new Set([...Object.keys(previous), ...Object.keys(row)]);
        const changes = [...columns].filter((column) => normalize(previous[column]) !== normalize(row[column]));
        if (changes.length) {
            lines.push(`  ~ ${k}: ` + changes.map((column) => `${column} ${normalize(previous[column]) || '(empty)'} -> ${normalize(row[column]) || '(empty)'}`).join(' · '));
        }
    }
    for (const k of old.keys()) if (!next.has(k)) lines.push(`  - ${k}`);
    return lines;
}

/** The snapshot to compare with: the named one, else the latest other snapshot of the commessa */
function findPrevious(commessa: string, compareWith: string | undefined, current: string): Snapshot | undefined {
    if (compareWith) {
        const file = path.join(SNAPSHOT_DIR, `${commessa}-${compareWith}.json`);
        if (!fs.existsSync(file)) throw new Error(`No snapshot "${compareWith}" of ${commessa} (${path.relative(ROOT, file)})`);
        return JSON.parse(fs.readFileSync(file, 'utf8')) as Snapshot;
    }
    if (!fs.existsSync(SNAPSHOT_DIR)) return undefined;
    const files = fs
        .readdirSync(SNAPSHOT_DIR)
        .filter((name) => name.startsWith(`${commessa}-`) && name.endsWith('.json'))
        .map((name) => path.join(SNAPSHOT_DIR, name))
        .filter((file) => file !== current)
        .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    return files[0] ? (JSON.parse(fs.readFileSync(files[0], 'utf8')) as Snapshot) : undefined;
}

async function main() {
    const [commessa, label = 'snapshot', compareWith] = process.argv.slice(2);
    if (!/^\d{9}$/.test(commessa ?? '') || !/^[\w-]+$/.test(label)) {
        console.error('Usage: npm run order:snapshot -- <commessa, 9 digits> <label> [compare-with-label]');
        process.exit(1);
    }
    loadEnv(path.join(ROOT, '.env.local'));
    // Imported only now: the connection reads the keys when the module loads
    const { queryMSSQL, getMSSQLPool } = await import('@/lib/mssql');

    const tables: Record<string, Row[]> = {};
    for (const spec of TABLES) {
        const result = await queryMSSQL<Row>(spec.sql, { commessa: spec.db === 'BUSINESS' ? Number(commessa) : commessa }, spec.db);
        tables[spec.name] = result.recordset;
    }

    fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
    const file = path.join(SNAPSHOT_DIR, `${commessa}-${label}.json`);
    const previous = findPrevious(commessa, compareWith, file);
    const snapshot: Snapshot = { commessa, label, takenAt: new Date().toISOString(), tables };
    fs.writeFileSync(file, JSON.stringify(snapshot, null, 2));
    console.log(`Saved ${path.relative(ROOT, file)}`);
    console.log('  ' + TABLES.map((spec) => `${spec.name} ${tables[spec.name].length}`).join(' · '));

    if (!previous) {
        console.log('No earlier snapshot of this commessa to compare with.');
    } else {
        console.log(`\nChanges since "${previous.label}" (${previous.takenAt}):`);
        let any = false;
        for (const spec of TABLES) {
            const lines = diffTable(spec, previous.tables[spec.name] ?? [], tables[spec.name]);
            if (!lines.length) continue;
            any = true;
            console.log(`\n${spec.name} [${spec.db}] (${(previous.tables[spec.name] ?? []).length} -> ${tables[spec.name].length} rows)`);
            for (const line of lines) console.log(line);
        }
        if (!any) console.log('  none: every row is the same.');
    }

    for (const db of ['BUSINESS', 'NETPRO'] as const) await (await getMSSQLPool(db)).close();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
