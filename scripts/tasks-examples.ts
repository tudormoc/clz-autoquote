/**
 * Regression check for the Agenda date rules (repeat rules, closed days, to-do groups, series planning, rule text)
 * against the example table in src/lib/tasks/examples.ts.
 *
 *   npm run tasks:examples
 */
import { runTaskExamples } from '@/lib/tasks/examples';

const results = runTaskExamples();
let failed = 0;

for (const { group, name, expected, actual, pass } of results) {
    if (!pass) failed++;
    console.log(`${pass ? 'OK  ' : 'FAIL'} ${group.padEnd(7)} ${name}`);
    if (!pass) {
        console.log(`     expected ${expected}`);
        console.log(`     actual   ${actual}`);
    }
}

console.log(`\n${results.length - failed}/${results.length} examples pass`);
process.exit(failed > 0 ? 1 : 0);
