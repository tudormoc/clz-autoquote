/**
 * Snapshot of everything Business and NetPro store about one commessa (one edition), to see what a change made in
 * the programs touches. Reads only (SELECT … WITH (NOLOCK)); needs .env.local (the database keys).
 *
 *   npm run order:snapshot -- 260999910 before          saves tmp/order-snapshots/260999910-before.json
 *   (change the order in Business or NetPro)
 *   npm run order:snapshot -- 260999910 after           saves …-after.json and prints what changed since the latest other snapshot
 *   npm run order:snapshot -- 260999910 after2 before   compares with "before" instead of the latest
 *
 * The tables and the comparison are the app's own (src/lib/orders/snapshot.ts, which Riallinea uses for its log):
 * Business movord, testord, attivit, assris, keyord, commess, cicli, movdis, artico; NetPro ORDINI, OPERAZIONI,
 * JOBSET, TASKS, MATERIALI_ORDINI, ANAG_MATERIALI and, here only, the FX* bridge rows. See docs/ORDER_PROCESS.md.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { SNAPSHOT_TABLES, diffSnapshots, snapshotOrder, type OrderSnapshot } from '@/lib/orders/snapshot';

const ROOT = path.resolve(__dirname, '..');
const SNAPSHOT_DIR = path.join(ROOT, 'tmp', 'order-snapshots');

interface SavedSnapshot {
    commessa: string;
    label: string;
    takenAt: string;
    tables: OrderSnapshot;
}

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

/** The snapshot to compare with: the named one, else the latest other snapshot of the commessa */
function findPrevious(commessa: string, compareWith: string | undefined, current: string): SavedSnapshot | undefined {
    if (compareWith) {
        const file = path.join(SNAPSHOT_DIR, `${commessa}-${compareWith}.json`);
        if (!fs.existsSync(file)) throw new Error(`No snapshot "${compareWith}" of ${commessa} (${path.relative(ROOT, file)})`);
        return JSON.parse(fs.readFileSync(file, 'utf8')) as SavedSnapshot;
    }
    if (!fs.existsSync(SNAPSHOT_DIR)) return undefined;
    const files = fs
        .readdirSync(SNAPSHOT_DIR)
        .filter((name) => name.startsWith(`${commessa}-`) && name.endsWith('.json'))
        .map((name) => path.join(SNAPSHOT_DIR, name))
        .filter((file) => file !== current)
        .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    return files[0] ? (JSON.parse(fs.readFileSync(files[0], 'utf8')) as SavedSnapshot) : undefined;
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

    const tables = await snapshotOrder(queryMSSQL, commessa, { bridge: true });

    fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
    const file = path.join(SNAPSHOT_DIR, `${commessa}-${label}.json`);
    const previous = findPrevious(commessa, compareWith, file);
    const snapshot: SavedSnapshot = { commessa, label, takenAt: new Date().toISOString(), tables };
    fs.writeFileSync(file, JSON.stringify(snapshot, null, 2));
    console.log(`Saved ${path.relative(ROOT, file)}`);
    console.log('  ' + SNAPSHOT_TABLES.map((table) => `${table.name} ${tables[table.name]?.length ?? 0}`).join(' · '));

    if (!previous) {
        console.log('No earlier snapshot of this commessa to compare with.');
    } else {
        console.log(`\nChanges since "${previous.label}" (${previous.takenAt}):`);
        const changes = diffSnapshots(previous.tables, tables);
        if (changes.length === 0) console.log('  none: every row is the same.');
        for (const table of SNAPSHOT_TABLES) {
            const rows = changes.filter((change) => change.table === table.name);
            if (rows.length === 0) continue;
            console.log(`\n${table.name} [${table.db}] (${(previous.tables[table.name] ?? []).length} -> ${(tables[table.name] ?? []).length} rows)`);
            for (const row of rows) {
                if (row.change === 'added') console.log(`  + ${row.key}`);
                else if (row.change === 'removed') console.log(`  - ${row.key}`);
                else console.log(`  ~ ${row.key}: ` + Object.entries(row.columns ?? {}).map(([column, [from, to]]) => `${column} ${from || '(empty)'} -> ${to || '(empty)'}`).join(' · '));
            }
        }
    }

    for (const db of ['BUSINESS', 'NETPRO'] as const) await (await getMSSQLPool(db)).close();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
