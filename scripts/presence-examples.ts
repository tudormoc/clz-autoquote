/**
 * Regression check for the presence formulas against the agreed example table
 * (src/lib/presence/examples.ts).
 *
 *   npm run presence:examples
 */
import { DEFAULT_PRESENCE_RULES, blockedStamps, eventForStatoChange, nameForCategory, type PresenceStamp } from '@/lib/presence';
import { runNoRecordExamples, runOperatorExceptionExamples, runPresenceExamples } from '@/lib/presence/examples';

const results = runPresenceExamples(DEFAULT_PRESENCE_RULES);
const noRecord = runNoRecordExamples(DEFAULT_PRESENCE_RULES);
const exceptions = runOperatorExceptionExamples(DEFAULT_PRESENCE_RULES);
let failed = 0;

for (const { example, actual, pass } of results) {
    if (!pass) failed++;
    const tag = `${(example.profile ?? 'standard').padEnd(8)} ${(example.day ?? 'working').padEnd(7)}`;
    const times = example.sessions ? example.sessions.map(([a, b]) => `${a}→${b}`).join(' ') : `${example.in} → ${example.out}`;
    const line = `${pass ? 'OK  ' : 'FAIL'} ${tag} ${times.padEnd(25)} ⇒ ${actual.countedStart} → ${actual.countedEnd}  ${actual.worked.toFixed(2)}h  ${JSON.stringify(actual.values)}`;
    console.log(line);
    if (!pass) {
        console.log(`     expected ${example.countedStart} → ${example.countedEnd}  ${example.worked.toFixed(2)}h  ${JSON.stringify(example.expect)}`);
    }
}

console.log('\n--- no clock records ---');
for (const { example, actual, pass } of noRecord) {
    if (!pass) failed++;
    const tag = `${example.profile.padEnd(8)} ${example.day.padEnd(7)}`;
    console.log(`${pass ? 'OK  ' : 'FAIL'} ${tag} (no records)  ⇒ ${JSON.stringify(actual)}  — ${example.note}`);
    if (!pass) console.log(`     expected ${JSON.stringify(example.expect)}`);
}

console.log('\n--- per-operator exception (OP6 = 6h) ---');
for (const { example, actual, pass } of exceptions) {
    if (!pass) failed++;
    const tag = `${example.profile.padEnd(8)} ${example.day.padEnd(7)}`;
    const times = example.in ? `${example.in} → ${example.out}` : '(no records)';
    console.log(`${pass ? 'OK  ' : 'FAIL'} ${tag} ${example.operatore.padEnd(6)} ${times.padEnd(14)} ⇒ ${JSON.stringify(actual)}  — ${example.note}`);
    if (!pass) console.log(`     expected ${JSON.stringify(example.expect)}`);
}

console.log('\n--- name mark by category (Interinali end with " *lb") ---');
const NAME_EXAMPLES: { name: string; reparto: string | null; expect: string; note: string }[] = [
    { name: 'ROSSI MARIO', reparto: '1001', expect: 'ROSSI MARIO *lb', note: 'a new interinale gets the mark' },
    { name: 'ROSSI MARIO *lb', reparto: '1001', expect: 'ROSSI MARIO *lb', note: 'never twice' },
    { name: 'ROSSI MARIO *LB ', reparto: '1001', expect: 'ROSSI MARIO *lb', note: 'any case, trimmed' },
    { name: 'ROSSI MARIO *lb', reparto: '2', expect: 'ROSSI MARIO', note: 'moved to Produzione: the mark goes' },
    { name: '  rossi mario  ', reparto: '3', expect: 'rossi mario', note: 'Ufficio: trimmed, no mark' },
    { name: 'ROSSI MARIO *lb', reparto: '999', expect: 'ROSSI MARIO *lb', note: 'OFF HR (who left): the name stays as it is' },
    { name: 'ROSSI MARIO', reparto: '999', expect: 'ROSSI MARIO', note: 'OFF HR: no mark added either' },
    { name: 'ROSSI MARIO *lb', reparto: '777', expect: 'ROSSI MARIO', note: 'unknown category: no mark' },
    { name: '   ', reparto: '1001', expect: '', note: 'an empty name stays empty' },
];
for (const { name, reparto, expect, note } of NAME_EXAMPLES) {
    const actual = nameForCategory(name, reparto);
    const pass = actual === expect;
    if (!pass) failed++;
    console.log(`${pass ? 'OK  ' : 'FAIL'} ${JSON.stringify(name).padEnd(20)} ${String(reparto).padEnd(5)} ⇒ ${JSON.stringify(actual)}  — ${note}`);
    if (!pass) console.log(`     expected ${JSON.stringify(expect)}`);
}

console.log('\n--- deleting presence events (refused when the operator did something else during that presence) ---');
const at = (time: string) => Date.parse(`2026-01-05T${time}Z`);
const stamp = (evento: string, time: string, progressivo = 0): PresenceStamp => ({ evento, at: at(time), progressivo });
const MORNING = [stamp('ENT', '07:25:00'), stamp('EXT', '12:31:50')];
const DOUBLE = [stamp('ENT', '07:01:00'), stamp('EXT', '12:41:53'), stamp('ENT', '13:22:00'), stamp('EXT', '13:22:00', 1), stamp('ENT', '13:31:34'), stamp('EXT', '17:06:00')];
const DELETE_EXAMPLES: { stamps: PresenceStamp[]; pick: number[]; others: string[]; expect: number[]; note: string }[] = [
    { stamps: [stamp('ENT', '15:30:13'), stamp('EXT', '15:30:19')], pick: [0, 1], others: ['15:16:32', '15:17:55'], expect: [], note: 'entry and exit with nothing between: both go' },
    { stamps: [stamp('ENT', '15:30:13'), stamp('EXT', '15:30:19')], pick: [1], others: [], expect: [], note: 'only the exit' },
    { stamps: [stamp('ENT', '15:30:13'), stamp('EXT', '15:30:19')], pick: [0], others: [], expect: [], note: 'only the entry' },
    { stamps: MORNING, pick: [0, 1], others: ['07:30:27', '12:31:37'], expect: [0, 1], note: 'work between entry and exit: both stay' },
    { stamps: MORNING, pick: [0], others: ['07:30:27'], expect: [0], note: 'work between: the entry alone stays too' },
    { stamps: MORNING, pick: [1], others: ['07:30:27'], expect: [1], note: 'work between: the exit alone stays too' },
    { stamps: DOUBLE, pick: [2, 3], others: ['08:00:00', '14:00:00'], expect: [], note: 'a double badge stamp (entry and exit of one instant) goes, work is elsewhere' },
    { stamps: DOUBLE, pick: [2, 3, 5], others: ['08:00:00', '14:00:00'], expect: [5], note: 'one refused among the picked ones is named' },
    { stamps: [stamp('ENT', '07:25:00')], pick: [0], others: ['07:30:27'], expect: [0], note: 'an entry with no exit yet and work after it stays' },
    { stamps: [stamp('ENT', '07:25:00')], pick: [0], others: ['07:10:00'], expect: [], note: 'an entry with no exit yet and nothing after it goes' },
    { stamps: [stamp('EXT', '15:23:52')], pick: [0], others: ['15:16:32'], expect: [], note: 'an exit with no entry before it stands alone' },
    { stamps: [stamp('ENT', '07:22:17'), stamp('EXT', '16:30:00')], pick: [1], others: ['16:30:00'], expect: [1], note: 'work suspended in the very second of the exit counts as between' },
    { stamps: [stamp('ENT', '07:00:00'), stamp('ENT', '07:05:00'), stamp('EXT', '12:00:00')], pick: [0], others: ['07:10:00'], expect: [], note: 'two entries in a row: the first ends at the second' },
    { stamps: [stamp('ENT', '07:00:00'), stamp('ENT', '07:05:00'), stamp('EXT', '12:00:00')], pick: [1], others: ['07:10:00'], expect: [1], note: 'two entries in a row: the second holds the work' },
];
for (const { stamps, pick, others, expect, note } of DELETE_EXAMPLES) {
    const blocked = blockedStamps(stamps, pick.map((index) => stamps[index]), others.map(at));
    const actual = stamps.flatMap((one, index) => (blocked.includes(one) ? [index] : []));
    const pass = JSON.stringify(actual) === JSON.stringify(expect);
    if (!pass) failed++;
    console.log(`${pass ? 'OK  ' : 'FAIL'} picked ${JSON.stringify(pick).padEnd(9)} refused ${JSON.stringify(actual).padEnd(7)} — ${note}`);
    if (!pass) console.log(`     expected ${JSON.stringify(expect)}`);
}

console.log('\n--- stato fisico changed by hand on Operatori: the event it needs ---');
const STATO_EXAMPLES: { from: string | null; to: string | null; last: string | null; expect: string | null; note: string }[] = [
    { from: 'IN', to: 'OUT', last: 'ENT', expect: 'EXT', note: 'went out and nothing recorded it: an exit' },
    { from: 'OUT', to: 'IN', last: 'EXT', expect: 'ENT', note: 'came in and nothing recorded it: an entry' },
    { from: 'OUT', to: 'IN', last: null, expect: 'ENT', note: 'the first entry ever' },
    { from: 'IN', to: 'OUT', last: 'EXT', expect: null, note: 'the stato was left wrong, the exit is already there: no double' },
    { from: 'OUT', to: 'IN', last: 'ENT', expect: null, note: 'the stato was left wrong (a deleted exit), the entry is already there: no double' },
    { from: 'IN', to: 'OUT', last: null, expect: null, note: 'no entry to close' },
    { from: 'in ', to: 'out', last: 'ent', expect: 'EXT', note: 'any case, trimmed' },
    { from: 'IN', to: 'OFF', last: 'ENT', expect: 'EXT', note: 'inside and set to OFF: the exit first' },
    { from: 'IN', to: 'OFF', last: 'EXT', expect: null, note: 'set to OFF, the exit is already there: no double' },
    { from: 'OFF', to: 'IN', last: 'EXT', expect: 'ENT', note: 'from OFF to inside: an entry' },
    { from: 'OFF', to: 'IN', last: null, expect: 'ENT', note: 'from OFF to inside, never clocked: an entry' },
    { from: 'OFF', to: 'IN', last: 'ENT', expect: null, note: 'from OFF to inside, the entry is already there: no double' },
    { from: 'OFF', to: 'OUT', last: 'EXT', expect: null, note: 'OFF to OUT: nobody came in or went out' },
    { from: 'OUT', to: 'OFF', last: 'EXT', expect: null, note: 'OUT to OFF: the same' },
    { from: 'OUT', to: 'OFF', last: 'ENT', expect: null, note: 'OUT to OFF with an entry left open: not this change\'s business' },
    { from: 'OUT', to: 'OUT', last: 'ENT', expect: null, note: 'no change' },
    { from: null, to: 'IN', last: null, expect: 'ENT', note: 'no stato before, now inside: an entry' },
    { from: 'IN', to: null, last: 'ENT', expect: 'EXT', note: 'the stato emptied while inside: an exit' },
];
for (const { from, to, last, expect, note } of STATO_EXAMPLES) {
    const actual = eventForStatoChange(from, to, last);
    const pass = actual === expect;
    if (!pass) failed++;
    console.log(`${pass ? 'OK  ' : 'FAIL'} ${String(from).padEnd(4)} → ${String(to).padEnd(4)} last ${String(last).padEnd(5)} ⇒ ${String(actual).padEnd(5)} — ${note}`);
    if (!pass) console.log(`     expected ${String(expect)}`);
}

const total = results.length + noRecord.length + exceptions.length + NAME_EXAMPLES.length + DELETE_EXAMPLES.length + STATO_EXAMPLES.length;
console.log(`\n${total - failed}/${total} examples pass`);
process.exit(failed > 0 ? 1 : 0);
