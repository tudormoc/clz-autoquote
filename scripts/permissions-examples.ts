/**
 * Regression check for the access rules (src/lib/auth/permissions.ts) on made-up groups:
 * grant keys, old links stored by groups, area rows, functions, who opens what.
 *
 *   npm run permissions:examples
 */
import { LINKS, NAV_AREAS, WORK_PROGRESS_FUNCTIONS } from '@/config/navigation';
import {
    GRANTABLE_FUNCTIONS,
    GRANTABLE_PAGES,
    canOpen,
    canOpenPath,
    canUse,
    cleanPermissions,
    functionLabels,
    grantable,
    mergePermissions,
    sharedLevel,
    visibleAreas,
    withLevel,
    type PagePermissions,
    type UserAccess,
} from '@/lib/auth/permissions';

const user = (pages: PagePermissions): UserAccess => ({ id: 1, name: 'Mario', superadmin: false, pages, groupIds: [1] });
const superadmin: UserAccess = { id: null, name: 'admin', superadmin: true, pages: {}, groupIds: [] };
const riallinea = GRANTABLE_FUNCTIONS[0];
const workProgress = NAV_AREAS.find((area) => area.id === 'work-progress')!;

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

    // Gruppi rows
    { name: 'the area row sets edit where possible, view elsewhere', expected: { quotes: 'edit', 'client-summary': 'view' }, actual: () => withLevel({}, [grantable(GRANTABLE_PAGES[0]), grantable(GRANTABLE_PAGES.find((p) => p.id === 'client-summary')!)], 'edit') },
    { name: 'the area row never grants a function', expected: false, actual: () => 'work-progress#riallinea' in withLevel({}, [grantable(workProgress)], 'edit') },
    { name: 'an area with pages at different levels is mixed', expected: 'mixed', actual: () => sharedLevel({ quotes: 'edit' }, [grantable(GRANTABLE_PAGES[0]), grantable(GRANTABLE_PAGES[1])]) },
    { name: 'a read-only page at view counts as edit for its area', expected: 'edit', actual: () => sharedLevel({ quotes: 'edit', 'client-summary': 'view' }, [grantable(GRANTABLE_PAGES[0]), grantable(GRANTABLE_PAGES.find((p) => p.id === 'client-summary')!)]) },
    { name: 'No removes the page', expected: {}, actual: () => withLevel({ quotes: 'edit' }, [grantable(GRANTABLE_PAGES[0])], null) },

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
