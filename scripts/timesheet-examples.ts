/**
 * Regression check of the timesheet's day rule, input checks and steps against the agreed examples
 * (src/lib/timesheet/examples.ts).
 *
 *   npm run timesheet:examples
 */
import { runDayExamples, runInputExamples, runStepExamples } from '@/lib/timesheet/examples';

let failed = 0;

console.log('--- what a day adds up to ---');
for (const { example, actual, pass } of runDayExamples()) {
    if (!pass) failed++;
    console.log(`${pass ? 'OK  ' : 'FAIL'} ${example.day} ${JSON.stringify(actual.hours).padEnd(42)} ${actual.status.padEnd(8)} missing ${actual.missing}  — ${example.note}`);
    if (!pass) console.log(`     expected ${JSON.stringify(example.expect)}`);
}

console.log('\n--- what the editor accepts ---');
for (const { example, actual, pass } of runInputExamples()) {
    if (!pass) failed++;
    console.log(`${pass ? 'OK  ' : 'FAIL'} ${(actual ?? 'fine').padEnd(44)} — ${example.note}`);
    if (!pass) console.log(`     expected ${example.expect ?? 'fine'}`);
}

console.log('\n--- steps ---');
for (const { note, actual, expect, pass } of runStepExamples()) {
    if (!pass) failed++;
    console.log(`${pass ? 'OK  ' : 'FAIL'} ${String(actual).padEnd(8)} — ${note}`);
    if (!pass) console.log(`     expected ${String(expect)}`);
}

const total = runDayExamples().length + runInputExamples().length + runStepExamples().length;
console.log(`\n${total - failed}/${total} examples pass`);
process.exit(failed > 0 ? 1 : 0);
