/**
 * Regression check for the presence formulas against the agreed example table
 * (src/lib/presence/examples.ts).
 *
 *   npm run presence:examples
 */
import { DEFAULT_PRESENCE_RULES } from '@/lib/presence';
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

const total = results.length + noRecord.length + exceptions.length;
console.log(`\n${total - failed}/${total} examples pass`);
process.exit(failed > 0 ? 1 : 0);
