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
import { lightCounts, lightState, sameGrants, withFunction, withLight, withPreset } from '@/lib/auth/lights';
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
