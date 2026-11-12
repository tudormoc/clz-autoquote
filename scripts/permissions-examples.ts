/**
 * Regression check for the access rules (src/lib/auth/permissions.ts) and the Gruppi lights (src/lib/auth/lights.ts)
 * on made-up groups: grant keys, old links stored by groups, lights and presets, functions, who opens what, whose
 * history a person sees in the Registro (src/lib/log/areas.ts).
 *
 *   npm run permissions:examples
 */
import { LINKS, LOG_FUNCTIONS, NAV_AREAS, WORK_PROGRESS_FUNCTIONS } from '@/config/navigation';
import {
    GRANTABLE_FUNCTIONS,
    GRANTABLE_PAGES,
    canOpen,
    canOpenPath,
    canUse,
    cleanPermissions,
    functionLabels,
    mergePermissions,
    visibleAreas,
    type PagePermissions,
    type UserAccess,
} from '@/lib/auth/permissions';
import { createGroupTicks } from '@/lib/auth/groupTicks';
import { lightCounts, lightState, sameGrants, withFunction, withLight, withPreset } from '@/lib/auth/lights';
import { computerOf, createLockout, type LockoutRules } from '@/lib/auth/lockout';
import { formatWait } from '@/lib/format';
import { visibleLogAreas } from '@/lib/log/areas';

const user = (pages: PagePermissions): UserAccess => ({ id: 1, name: 'Mario', superadmin: false, pages, groupIds: [1] });
const superadmin: UserAccess = { id: null, name: 'admin', superadmin: true, pages: {}, groupIds: [] };
const riallinea = GRANTABLE_FUNCTIONS.find(({ key }) => key === 'work-progress#riallinea');
const workProgress = NAV_AREAS.find((area) => area.id === 'work-progress')!;
const page = (id: string) => GRANTABLE_PAGES.find((candidate) => candidate.id === id)!;
const quotes = page('quotes');
const clientSummary = page('client-summary');
const logPage = page('log');
const historyPage = GRANTABLE_PAGES.find((candidate) => candidate.href === LINKS.tasks.history)!;

// Wrong PINs: two computers, a fixed "now", and the app's own numbers written out (constants.ts → AUTH)
type Lockout = ReturnType<typeof createLockout>;
const LOCK_RULES: LockoutRules = { attempts: 5, nameAttempts: 30, stepsMinutes: [5, 15, 60, 240, 1440], forgetHours: 24, maxEntries: 5000, nameLength: 100 };
const PC_A = '192.168.1.57';
const PC_B = '192.168.1.80';
/** The machine the app runs on, as the network sees it */
const PC_APP = '192.168.1.112';
const MINUTE = 60_000;
const NOW = Date.UTC(2026, 10, 12, 9, 0);
const LATER = NOW + 30 * MINUTE;
const wrong = (lock: Lockout, name: string, computer: string, times: number, now: number) => {
    for (let i = 0; i < times; i++) lock.recordFailure(name, computer, now);
};
/** One wrong PIN from each of `count` computers nobody used yet */
const manyComputers = (lock: Lockout, name: string, count: number, now: number, from = 0) => {
    for (let i = 0; i < count; i++) lock.recordFailure(name, `10.0.${Math.floor((from + i) / 250)}.${(from + i) % 250}`, now);
};
/** The waits of `rounds` rounds of five wrong PINs, each round made as soon as the wait before is over */
const waits = (lock: Lockout, name: string, computer: string, rounds: number) => {
    let now = NOW;
    const found: number[] = [];
    for (let round = 0; round < rounds; round++) {
        wrong(lock, name, computer, 5, now);
        const wait = lock.minutesLocked(name, computer, now);
        found.push(wait);
        now += wait * MINUTE;
    }
    return found;
};

const EXAMPLES: { name: string; expected: unknown; actual: () => unknown }[] = [
    { name: 'every page has a different id', expected: GRANTABLE_PAGES.length, actual: () => new Set(GRANTABLE_PAGES.map((page) => page.id)).size },
    { name: 'the Riallinea function is grantable under its page', expected: 'work-progress#riallinea', actual: () => riallinea?.key },

    // Stored groups: keys are page ids; links (the old form) are converted; unknown entries are dropped
    { name: 'a stored page id is kept', expected: { 'daily-events': 'edit' }, actual: () => cleanPermissions({ 'daily-events': 'edit' }) },
    { name: 'a stored link becomes the page id', expected: { 'daily-events': 'view' }, actual: () => cleanPermissions({ '/presence/daily-events': 'view' }) },
    { name: 'a stored function link becomes its key', expected: { 'work-progress#riallinea': 'edit' }, actual: () => cleanPermissions({ '/work-progress#riallinea': 'edit' }) },
    { name: 'edit on a page that cannot be changed becomes view', expected: { 'client-summary': 'view' }, actual: () => cleanPermissions({ 'client-summary': 'edit' }) },
    { name: 'a function stored as view is dropped', expected: {}, actual: () => cleanPermissions({ 'work-progress#riallinea': 'view' }) },
    { name: 'unknown pages, functions and levels are dropped', expected: {}, actual: () => cleanPermissions({ nope: 'view', '/nope': 'edit', 'work-progress#nope': 'edit', quotes: 'admin' }) },
    { name: 'damaged value gives no pages', expected: {}, actual: () => cleanPermissions('x') },

    // Several groups: the highest level wins
    { name: 'merge keeps the highest level', expected: { quotes: 'edit', cashflow: 'view' }, actual: () => mergePermissions([{ quotes: 'view', cashflow: 'view' }, { quotes: 'edit' }]) },


    // Gruppi lights: a click on a light becomes grants, and the lights follow each other
    { name: 'Modifica on switches Vede on', expected: { quotes: 'edit' }, actual: () => withLight({}, [quotes], 'modify', true) },
    { name: 'Vede on leaves Modifica as it is', expected: { quotes: 'edit' }, actual: () => withLight({ quotes: 'edit' }, [quotes], 'see', true) },
    { name: 'Modifica off keeps Vede and switches the own function of the page off', expected: { 'work-progress': 'view' }, actual: () => withLight({ 'work-progress': 'edit', 'work-progress#riallinea': 'edit' }, [workProgress], 'modify', false) },
    { name: 'Vede off switches off Modifica and the function of the page, other pages stay', expected: { quotes: 'view' }, actual: () => withLight({ 'work-progress': 'edit', 'work-progress#riallinea': 'edit', quotes: 'view' }, [workProgress], 'see', false) },
    { name: 'an own function switched on raises its page to Modifica', expected: { 'work-progress': 'edit', 'work-progress#riallinea': 'edit' }, actual: () => withFunction({}, workProgress, workProgress.functions![0], true) },
    { name: 'Tutto il registro switches Vede on for the Registro page', expected: { log: 'view', 'log#tutto': 'edit' }, actual: () => withFunction({}, logPage, logPage.functions![0], true) },
    { name: 'an own function switched off leaves the page as it is', expected: { 'work-progress': 'edit' }, actual: () => withFunction({ 'work-progress': 'edit', 'work-progress#riallinea': 'edit' }, workProgress, workProgress.functions![0], false) },
    { name: 'the Modifica light of a row touches only the pages that change data', expected: { quotes: 'edit' }, actual: () => withLight({}, [quotes, clientSummary], 'modify', true) },
    { name: 'a row never switches a function on', expected: { 'work-progress': 'edit' }, actual: () => withLight({}, [workProgress], 'modify', true) },
    { name: 'a row is on, some or off; a light no page has is null', expected: ['on', 'some', 'off', null], actual: () => [lightState({ quotes: 'edit' }, [quotes, clientSummary], 'modify'), lightState({ quotes: 'edit' }, [quotes, clientSummary], 'see'), lightState({}, [quotes], 'see'), lightState({}, [clientSummary], 'modify')] },
    { name: 'Niente switches everything off', expected: {}, actual: () => withPreset({ quotes: 'edit', 'work-progress': 'edit', 'work-progress#riallinea': 'edit' }, 'none') },
    { name: 'Solo lettura: every page seen, none modified, no function that needs Modifica', expected: { see: GRANTABLE_PAGES.length, modify: 0, functions: 0 }, actual: () => lightCounts(withPreset({ 'work-progress': 'edit', 'work-progress#riallinea': 'edit' }, 'read')) },
    { name: 'Solo lettura keeps Tutto il registro, which needs only Vede', expected: 'edit', actual: () => withPreset({ log: 'view', 'log#tutto': 'edit' }, 'read')['log#tutto'] },
    { name: 'Tutto: every page at its highest level, functions not switched on', expected: { see: GRANTABLE_PAGES.length, modify: GRANTABLE_PAGES.filter((candidate) => candidate.editable).length, functions: 0 }, actual: () => lightCounts(withPreset({}, 'all')) },
    { name: 'the same grants in another order are the same; one level changed is not', expected: [true, false, false], actual: () => [sameGrants({ quotes: 'edit', log: 'view' }, { log: 'view', quotes: 'edit' }), sameGrants({ quotes: 'edit' }, { quotes: 'view' }), sameGrants({ quotes: 'edit' }, { quotes: 'edit', log: 'view' })] },
    { name: 'a starting point the group already is changes nothing', expected: true, actual: () => sameGrants(withPreset({}, 'all'), withPreset(withPreset({}, 'all'), 'all')) },

    // Who opens what (checks take links)
    { name: 'view opens the page', expected: true, actual: () => canOpen(user({ 'daily-events': 'view' }), LINKS.presence.dailyEvents) },
    { name: 'view does not edit it', expected: false, actual: () => canOpen(user({ 'daily-events': 'view' }), LINKS.presence.dailyEvents, 'edit') },
    { name: 'a page not given is closed', expected: false, actual: () => canOpen(user({ 'daily-events': 'view' }), LINKS.presence.operators) },
    { name: 'a link of nothing grantable is closed', expected: false, actual: () => canOpen(user({ quotes: 'edit' }), '/nope') },
    { name: 'Riallinea needs the function, not only edit on the page', expected: [false, true], actual: () => [canUse(user({ 'work-progress': 'edit' }), WORK_PROGRESS_FUNCTIONS.riallinea), canUse(user({ 'work-progress': 'edit', 'work-progress#riallinea': 'edit' }), WORK_PROGRESS_FUNCTIONS.riallinea)] },
    { name: 'the superadmin opens and uses everything', expected: [true, true], actual: () => [canOpen(superadmin, LINKS.settings['users'], 'edit'), canUse(superadmin, WORK_PROGRESS_FUNCTIONS.riallinea)] },
    { name: 'the menu lists only the areas with a page given', expected: ['presence'], actual: () => visibleAreas(user({ 'daily-events': 'view' })).map((area) => area.id) },
    { name: 'the area overview opens when one of its pages is given', expected: [true, false], actual: () => [canOpenPath(user({ 'daily-events': 'view' }), '/presence'), canOpenPath(user({ 'daily-events': 'view' }), '/analytics')] },
    { name: 'a superadmin-only page is closed to everyone else', expected: false, actual: () => canOpenPath(user({ 'client-summary': 'view' }), LINKS.settings['users']) },
    { name: 'Utenti, Gruppi and Database cannot be given to a group', expected: {}, actual: () => cleanPermissions({ users: 'edit', groups: 'edit', database: 'view' }) },

    // The Registro: no grant per page; its entries follow the pages a person can open, "Tutto il registro" shows all
    { name: 'the only functions are the named ones', expected: ['work-progress#riallinea', 'operators#anagrafica', 'log#tutto'], actual: () => GRANTABLE_FUNCTIONS.map(({ key }) => key) },
    { name: 'a Registro light stored per page (before 2026-11-06) is dropped', expected: { quotes: 'view' }, actual: () => cleanPermissions({ quotes: 'view', 'quotes#registro': 'edit' }) },
    { name: 'the Registro shows the history of the pages the person can open', expected: ['operators', 'log'], actual: () => visibleLogAreas(user({ operators: 'view', log: 'view' })) },
    { name: "the Agenda's log follows Storico, the timesheet's Ore Ufficio", expected: [true, true, false], actual: () => [visibleLogAreas(user({ [historyPage.id]: 'view' }))?.includes('tasks'), visibleLogAreas(user({ 'office-hours': 'view' }))?.includes('timesheet'), visibleLogAreas(user({ quotes: 'edit' }))?.includes('timesheet')] },
    { name: 'Tutto il registro is its own grant', expected: [false, true], actual: () => [canUse(user({ log: 'view' }), LOG_FUNCTIONS.all), canUse(user({ log: 'view', 'log#tutto': 'edit' }), LOG_FUNCTIONS.all)] },
    { name: 'Tutto il registro shows every page a group can be given, plus the Agenda and the timesheet', expected: GRANTABLE_PAGES.length + 2, actual: () => visibleLogAreas(user({ log: 'view', 'log#tutto': 'edit' }))?.length },
    { name: 'only the superadmin sees every entry, logins and users included (no filter)', expected: true, actual: () => visibleLogAreas(superadmin) === undefined },
    { name: 'the tooltip names the functions given', expected: ['Avanzamento Lavori · Riallinea ordine da DiBa'], actual: () => functionLabels({ 'work-progress#riallinea': 'edit' }) },

    // Wrong PINs (src/lib/auth/lockout.ts): counted per name and computer, the wait grows, the superadmin can take it away
    { name: 'wrong PINs: four give no wait, the fifth gives 5 minutes', expected: [0, 5], actual: () => { const lock = createLockout(); wrong(lock, 'Mario', PC_A, 4, NOW); const before = lock.minutesLocked('Mario', PC_A, NOW); wrong(lock, 'Mario', PC_A, 1, NOW); return [before, lock.minutesLocked('Mario', PC_A, NOW)]; } },
    { name: 'wrong PINs: the same name is not locked on another computer, another name not on the same one', expected: [0, 0], actual: () => { const lock = createLockout(); wrong(lock, 'Mario', PC_A, 5, NOW); return [lock.minutesLocked('Mario', PC_B, NOW), lock.minutesLocked('Anna', PC_A, NOW)]; } },
    { name: 'wrong PINs: capitals and spaces around the name do not make another name', expected: 5, actual: () => { const lock = createLockout(); wrong(lock, 'Mario', PC_A, 5, NOW); return lock.minutesLocked('  MARIO ', PC_A, NOW); } },
    { name: 'wrong PINs: the wait counts down and ends', expected: [5, 3, 0], actual: () => { const lock = createLockout(); wrong(lock, 'Mario', PC_A, 5, NOW); return [0, 2.5, 5].map((minutes) => lock.minutesLocked('Mario', PC_A, NOW + minutes * MINUTE)); } },
    { name: 'wrong PINs: every time the limit is reached again the wait is longer, up to a day', expected: [5, 15, 60, 240, 1440, 1440], actual: () => waits(createLockout(), 'Mario', PC_A, 6) },
    { name: 'wrong PINs: the right PIN clears that computer, the next wait is 5 minutes again', expected: [5, 15, 5], actual: () => { const lock = createLockout(); const first = waits(lock, 'Mario', PC_A, 2); lock.clearFailures('Mario', PC_A); wrong(lock, 'Mario', PC_A, 5, LATER); return [...first, lock.minutesLocked('Mario', PC_A, LATER)]; } },
    { name: 'wrong PINs: a day without one, and the waits start over', expected: [5, 5], actual: () => { const lock = createLockout(); wrong(lock, 'Mario', PC_A, 5, NOW); const first = lock.minutesLocked('Mario', PC_A, NOW); const nextDay = NOW + 25 * 60 * MINUTE; wrong(lock, 'Mario', PC_A, 5, nextDay); return [first, lock.minutesLocked('Mario', PC_A, nextDay)]; } },
    { name: 'wrong PINs: 30 for one name from 30 computers lock the name on every computer', expected: [0, 5], actual: () => { const lock = createLockout(); manyComputers(lock, 'Mario', 29, NOW); const before = lock.minutesLocked('Mario', PC_A, NOW); manyComputers(lock, 'Mario', 1, NOW, 29); return [before, lock.minutesLocked('Mario', PC_A, NOW)]; } },
    { name: 'wrong PINs: the right PIN of the real person does not shorten the next name-wide wait', expected: [5, 15], actual: () => { const lock = createLockout(); manyComputers(lock, 'Mario', 30, NOW); const first = lock.minutesLocked('Mario', PC_A, NOW); const after = NOW + 6 * MINUTE; lock.clearFailures('Mario', PC_A); manyComputers(lock, 'Mario', 30, after, 100); return [first, lock.minutesLocked('Mario', PC_A, after)]; } },
    { name: 'wrong PINs: the lock on the user\'s row is the longest wait of the name on any computer', expected: [15, 0], actual: () => { const lock = createLockout(); waits(lock, 'Mario', PC_A, 1); const now = NOW + 6 * MINUTE; wrong(lock, 'Mario', PC_A, 5, now); wrong(lock, 'Mario', PC_B, 5, now); return [lock.waitOfName('Mario', now), lock.waitOfName('Anna', now)]; } },
    { name: 'wrong PINs: the superadmin takes the wait away, on every computer at once', expected: [true, 0, 0, 0, false], actual: () => { const lock = createLockout(); wrong(lock, 'Mario', PC_A, 5, NOW); manyComputers(lock, 'Mario', 30, NOW); const taken = lock.unlockName('mario'); return [taken, lock.minutesLocked('Mario', PC_A, NOW), lock.minutesLocked('Mario', PC_B, NOW), lock.waitOfName('Mario', NOW), lock.unlockName('Mario')]; } },
    { name: 'wrong PINs: endless made-up names do not fill the memory', expected: true, actual: () => { const lock = createLockout({ ...LOCK_RULES, maxEntries: 20 }); for (let i = 0; i < 500; i++) lock.recordFailure(`nome ${i}`, PC_A, NOW + i); return lock.size() <= 20; } },
    { name: 'wrong PINs: the computer is the first address Next gives, written the short way; "unknown" without one', expected: ['192.168.1.57', '192.168.1.57', '192.168.1.57', 'unknown', 'unknown'], actual: () => ['192.168.1.57', ' 192.168.1.57 , 10.0.0.1', '::ffff:192.168.1.57', '', null].map((address) => computerOf(address, PC_APP)) },
    { name: 'wrong PINs: a browser on the app\'s own machine ("::1") shows that machine\'s address on the network', expected: [PC_APP, PC_APP, PC_APP, 'localhost'], actual: () => [computerOf('::1', PC_APP), computerOf('127.0.0.1', PC_APP), computerOf('::ffff:127.0.0.1', PC_APP), computerOf('::1', null)] },
    { name: 'wrong PINs: the wait as text, never shorter than the wait', expected: ['1 min', '5 min', '1 h', '2 h', '24 h'], actual: () => [0.2, 5, 60, 61, 1440].map(formatWait) },

    // Utenti: group ticks made quickly one after the other (each tick saves the user's whole list). User 1 is in group 10
    { name: 'group ticks: a second quick tick keeps the first (the screen still shows the old list)', expected: [[10, 20], [10, 20, 30]], actual: () => { const ticks = createGroupTicks(); return [ticks.tick(1, [10], 20, true), ticks.tick(1, [10], 30, true)]; } },
    { name: 'group ticks: a quick tick and a quick untick both count', expected: [[10, 20, 30], [20, 30]], actual: () => { const ticks = createGroupTicks(); return [ticks.tick(1, [10, 20], 30, true), ticks.tick(1, [10, 20], 10, false)]; } },
    { name: 'group ticks: the same group ticked twice is in the list once', expected: [10, 20], actual: () => { const ticks = createGroupTicks(); ticks.tick(1, [10], 20, true); return ticks.tick(1, [10], 20, true); } },
    { name: 'group ticks: every user has their own list', expected: [[10, 20], [50, 30]], actual: () => { const ticks = createGroupTicks(); return [ticks.tick(1, [10], 20, true), ticks.tick(2, [50], 30, true)]; } },
    { name: 'group ticks: the first save is back, the second still on its way: the third tick keeps both', expected: [10, 20, 30, 40], actual: () => { const ticks = createGroupTicks(); ticks.tick(1, [10], 20, true); ticks.tick(1, [10], 30, true); ticks.settled(1); ticks.readBack(); return ticks.tick(1, [10, 20], 40, true); } },
    { name: 'group ticks: both saves are back but the screen is not redrawn yet: still from the ticks', expected: [10, 20, 30, 40], actual: () => { const ticks = createGroupTicks(); ticks.tick(1, [10], 20, true); ticks.tick(1, [10], 30, true); ticks.settled(1); ticks.settled(1); return ticks.tick(1, [10], 40, true); } },
    { name: 'group ticks: saves back and list read again: the next tick starts from what is stored', expected: [10, 20, 30, 40], actual: () => { const ticks = createGroupTicks(); ticks.tick(1, [10], 20, true); ticks.tick(1, [10], 30, true); ticks.settled(1); ticks.settled(1); ticks.readBack(); return ticks.tick(1, [10, 20, 30], 40, true); } },
    { name: 'group ticks: a refused save is not carried into the next tick', expected: [10, 40], actual: () => { const ticks = createGroupTicks(); ticks.tick(1, [10], 20, true); ticks.settled(1); ticks.readBack(); return ticks.tick(1, [10], 40, true); } },
];

let failed = 0;
for (const { name, expected, actual } of EXAMPLES) {
    const want = JSON.stringify(expected);
    const got = JSON.stringify(actual());
    const pass = want === got;
    if (!pass) failed++;
    console.log(`${pass ? 'OK  ' : 'FAIL'} ${name}`);
    if (!pass) {
        console.log(`     expected ${want}`);
        console.log(`     actual   ${got}`);
    }
}
console.log(`\n${EXAMPLES.length - failed}/${EXAMPLES.length} examples pass`);
process.exit(failed > 0 ? 1 : 0);
