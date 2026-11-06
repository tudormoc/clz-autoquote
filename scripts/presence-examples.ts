/**
 * Regression check for the presence formulas against the agreed example table
 * (src/lib/presence/examples.ts).
 *
 *   npm run presence:examples
 */
import { DEFAULT_PRESENCE_RULES, nameForCategory } from '@/lib/presence';
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

const total = results.length + noRecord.length + exceptions.length + NAME_EXAMPLES.length;
console.log(`\n${total - failed}/${total} examples pass`);
process.exit(failed > 0 ? 1 : 0);
