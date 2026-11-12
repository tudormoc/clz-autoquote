/**
 * Regression check for the presence formulas against the agreed example table
 * (src/lib/presence/examples.ts).
 *
 *   npm run presence:examples
 */
import {
    DEFAULT_PRESENCE_RULES,
    blockedStamps,
    chooseExit,
    clockToSeconds,
    eventForStatoChange,
    exitGuesses,
    minutesToTime,
    nameForCategory,
    othersSlot,
    realExits,
    secondsToClock,
    timeToMinutes,
    type DayStamp,
    type PastExit,
    type PresenceStamp,
} from '@/lib/presence';
import { runNoRecordExamples, runOperatorExceptionExamples, runPresenceExamples } from '@/lib/presence/examples';
import type { AutoExitDecision, runAutoExit } from '@/app/presence/auto-exit';
import { APP_COPY } from '@/locales';
import { readAnswer } from './scheduler.js';

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

console.log('\n--- automatic exit: the time a forgotten exit is dated at (the person\'s usual exit) ---');
/** A person's past exits, newest first: [own time, the time the others left that day] */
const pastExits = (...days: [own: string, others: string | null][]): PastExit[] =>
    days.map(([own, others], index) => ({ day: `2026-11-${String(20 - index).padStart(2, '0')}`, slot: timeToMinutes(own), others: others === null ? null : timeToMinutes(others) }));
const WITH_OTHERS = pastExits(['16:30', '16:30'], ['16:30', '16:30'], ['16:30', '16:30']);
const EXIT_EXAMPLES: { past: PastExit[]; others: string | null; after?: string; now?: string; expect: string; note: string }[] = [
    { past: WITH_OTHERS, others: '16:30', expect: '16:30:00 withOthers', note: 'leaves with the others: the time the others left today' },
    { past: WITH_OTHERS, others: '15:30', expect: '15:30:00 withOthers', note: 'first day of the summer hours: follows the others at once' },
    { past: WITH_OTHERS, others: null, expect: '16:30:00 lastExits', note: 'nobody left yet today: the person\'s own last exits' },
    { past: pastExits(['17:30', '16:30'], ['17:30', '16:30'], ['16:30', '16:30']), others: '16:30', expect: '17:30:00 lastExits', note: 'on the late turn this week (the last two at 17:30): 17:30' },
    { past: pastExits(['16:30', '16:30'], ['16:30', '16:30'], ['17:30', '16:30'], ['17:30', '16:30']), others: '16:30', expect: '16:30:00 withOthers', note: 'back with the others this week: older days do not count' },
    { past: pastExits(['14:30', '16:30'], ['16:30', '16:30'], ['16:30', '16:30'], ['16:30', '16:30'], ['15:00', '16:30']), others: '16:30', expect: '16:30:00 recentExits', note: 'the last two differ: three of the last five at 16:30' },
    { past: pastExits(['12:30', '16:30'], ['17:00', '16:30'], ['16:30', '16:30'], ['15:00', '16:30'], ['17:30', '16:30']), others: '16:30', expect: '16:30:00 othersToday', note: 'no pattern at all: the time the others left today' },
    { past: pastExits(['12:30', '16:30'], ['17:00', '16:30']), others: null, expect: '16:30:00 standard', note: 'no pattern and nobody left yet: the standard time' },
    { past: [], others: '16:30', expect: '16:30:00 othersToday', note: 'a new person: the others today' },
    { past: [], others: null, expect: '16:30:00 standard', note: 'a new person, nobody left yet: the standard time' },
    { past: pastExits(['16:30', '16:30']), others: '15:30', expect: '15:30:00 othersToday', note: 'one exit is not a pattern yet: the others today' },
    { past: pastExits(['12:30', '16:30'], ['12:30', '16:30']), others: '16:30', after: '13:20:10', expect: '16:30:00 othersToday', note: 'usually leaves at 12:30 but came back at 13:20 today: the next possible guess' },
    { past: WITH_OTHERS, others: '16:30', after: '16:45:10', expect: '19:00:00 now', note: 'started work at 16:45: every guess is before it, the moment of the check' },
    { past: WITH_OTHERS, others: null, now: '11:27:49', expect: '11:27:49 now', note: 'run by hand in the morning: never an exit in the future' },
    { past: WITH_OTHERS, others: null, after: '11:27:48', now: '11:27:49', expect: 'none', note: 'entered a second ago: no exit yet' },
];
for (const { past, others, after, now, expect, note } of EXIT_EXAMPLES) {
    const guesses = exitGuesses(past, others === null ? null : timeToMinutes(others), timeToMinutes('16:30'));
    const choice = chooseExit(guesses, clockToSeconds(after ?? '07:25:00'), clockToSeconds(now ?? '19:00:00'));
    const actual = choice ? `${secondsToClock(choice.second)} ${choice.reason}` : 'none';
    const pass = actual === expect;
    if (!pass) failed++;
    console.log(`${pass ? 'OK  ' : 'FAIL'} ${actual.padEnd(22)} — ${note}`);
    if (!pass) console.log(`     expected ${expect}`);
}

console.log('\n--- automatic exit: which past exits are real, and the time the others left ---');
const dayStamp = (operator: string, time: string, evento: string, writer = 'SSQ', progressivo = 0): DayStamp => ({ operator, day: '2026-11-10', time, evento, writer, progressivo });
const REAL_EXIT_EXAMPLES: { stamps: DayStamp[]; expect: string; note: string }[] = [
    { stamps: [dayStamp('A', '07:25:00', 'ENT'), dayStamp('A', '12:31:50', 'EXT', 'MES'), dayStamp('A', '13:13:58', 'ENT', 'MES'), dayStamp('A', '16:36:00', 'EXT')], expect: 'A 16:30', note: 'the last exit of the day, not the one of lunch' },
    { stamps: [dayStamp('A', '07:25:00', 'ENT'), dayStamp('A', '16:30:00', 'EXT', 'AUTO')], expect: '', note: 'an automatic exit teaches nothing' },
    { stamps: [dayStamp('A', '07:25:00', 'ENT'), dayStamp('A', '16:30:35', 'EXT', 'ADMIN')], expect: '', note: 'an exit typed in afterwards teaches nothing' },
    { stamps: [dayStamp('A', '07:25:00', 'ENT'), dayStamp('A', '12:31:00', 'EXT'), dayStamp('A', '13:20:00', 'ENT')], expect: '', note: 'a day left open: no exit' },
    { stamps: [dayStamp('A', '07:25:00', 'ENT'), dayStamp('A', '13:22:00', 'ENT', 'SSQ', 0), dayStamp('A', '13:22:00', 'EXT', 'SSQ', 1)], expect: 'A 13:00', note: 'a double stamp of one instant ends with the exit' },
    { stamps: [dayStamp('A', '16:59:59', 'EXT'), dayStamp('B', '17:00:00', 'EXT', 'DIEGO')], expect: 'A 16:30, B 17:00', note: 'by the half hour, rounded down' },
];
for (const { stamps, expect, note } of REAL_EXIT_EXAMPLES) {
    const actual = realExits(stamps).map((exit) => `${exit.operator} ${minutesToTime(exit.slot)}`).sort().join(', ');
    const pass = actual === expect;
    if (!pass) failed++;
    console.log(`${pass ? 'OK  ' : 'FAIL'} ${(actual || '(none)').padEnd(18)} — ${note}`);
    if (!pass) console.log(`     expected ${expect || '(none)'}`);
}
const OTHERS_EXAMPLES: { slots: string[]; expect: string | null; note: string }[] = [
    { slots: ['16:30', '16:30', '16:30', '17:30', '12:30'], expect: '16:30', note: 'most left at 16:30' },
    { slots: ['16:30', '16:30'], expect: null, note: 'two people are not "the others"' },
    { slots: ['15:30', '15:30', '16:30', '16:30'], expect: '15:30', note: 'two times just as common: the earlier one' },
    { slots: ['12:30', '15:30', '16:30', '17:00', '17:30', '18:00', '14:00'], expect: null, note: 'everybody at a different time: no common time' },
];
for (const { slots, expect, note } of OTHERS_EXAMPLES) {
    const slot = othersSlot(slots.map(timeToMinutes));
    const actual = slot === null ? null : minutesToTime(slot);
    const pass = actual === expect;
    if (!pass) failed++;
    console.log(`${pass ? 'OK  ' : 'FAIL'} ${String(actual).padEnd(18)} — ${note}`);
    if (!pass) console.log(`     expected ${String(expect)}`);
}

// What the scheduler (scripts/scheduler.js) makes of the app's answer to the daily automatic exit: did the run end
// well, and does it call again. The answers are typed as the app's own (runAutoExit), so a field renamed there fails
// the typecheck here: the scheduler is plain JavaScript and would otherwise go on reading a field that is gone.
type AutoExitAnswer = Awaited<ReturnType<typeof runAutoExit>>;
const decision = (operator: string, written: boolean, error?: string): AutoExitDecision => ({
    operator, name: null, stillIn: true, exitTime: '16:30:00', reason: 'standard', why: '', lastExits: [], written, ...(error === undefined ? {} : { error }), paused: [],
});
const ran = (exits: AutoExitDecision[]): AutoExitAnswer => ({
    success: true, skipped: false, preview: false, date: '2026-11-12', checkedAt: '19:00:00', standardTime: '16:30', othersToday: null,
    processed: exits.filter((exit) => exit.written).length, failed: exits.filter((exit) => exit.error !== undefined).length, exits,
});
const SCHEDULER_EXAMPLES: { status: number; answer: AutoExitAnswer | string; expect: string; note: string }[] = [
    { status: 200, answer: ran([decision('12', true), decision('98', true)]), expect: 'ended well', note: 'every exit written' },
    { status: 200, answer: ran([]), expect: 'ended well', note: 'nobody was still in' },
    { status: 200, answer: ran([decision('12', true), decision('98', false)]), expect: 'ended well', note: 'someone badged out in the meantime: no failure' },
    { status: 200, answer: { success: true, skipped: true, reason: APP_COPY.analytics.presence.autoExitSunday, processed: 0, failed: 0, exits: [] }, expect: 'ended well', note: 'a day that is not worked' },
    { status: 200, answer: ran([decision('12', true), decision('98', false, 'deadlock')]), expect: 'calls again', note: 'one exit could not be written' },
    { status: 200, answer: { success: false, error: 'Connection lost', processed: 1, failed: 0, exits: [decision('12', true)] }, expect: 'calls again', note: 'the run broke off' },
    { status: 403, answer: '{"success":false,"error":"Forbidden"}', expect: 'gives up', note: 'refused, the key is wrong: calling again cannot help' },
    { status: 500, answer: 'Internal Server Error', expect: 'calls again', note: 'an error page of the server' },
    { status: 200, answer: 'starting...', expect: 'calls again', note: 'an answer that is not JSON' },
];
for (const { status, answer, expect, note } of SCHEDULER_EXAMPLES) {
    const read = readAnswer(status, typeof answer === 'string' ? answer : JSON.stringify(answer));
    const actual = read.ok ? 'ended well' : read.retry ? 'calls again' : 'gives up';
    const pass = actual === expect;
    if (!pass) failed++;
    console.log(`${pass ? 'OK  ' : 'FAIL'} ${actual.padEnd(18)} — scheduler: ${note} ⇒ "${read.text}"`);
    if (!pass) console.log(`     expected ${expect}`);
}

const total =
    results.length + noRecord.length + exceptions.length + NAME_EXAMPLES.length + DELETE_EXAMPLES.length + STATO_EXAMPLES.length +
    EXIT_EXAMPLES.length + REAL_EXIT_EXAMPLES.length + OTHERS_EXAMPLES.length + SCHEDULER_EXAMPLES.length;
console.log(`\n${total - failed}/${total} examples pass`);
process.exit(failed > 0 ? 1 : 0);
