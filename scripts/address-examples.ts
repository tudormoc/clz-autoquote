/**
 * Regression check for what a screen keeps in the address bar (src/lib/address.ts): view values (tab, sort, page,
 * chips), the applied filters of a list, and that what is written is read back the same.
 *
 *   npm run address:examples
 */
import {
    addressOf,
    choiceParam,
    countChangedFilters,
    dayParam,
    filtersKey,
    flagParam,
    insideLink,
    listParam,
    listText,
    monthParam,
    numberParam,
    pageParam,
    patchAddress,
    readAddress,
    readFilters,
    sortParam,
    textList,
    textParam,
    writeFilters,
} from '@/lib/address';

const VIEW = {
    sheet: choiceParam(['clz', 'interinali'], 'clz'),
    sort: sortParam({ column: 'value', direction: 'desc' }),
    page: pageParam(),
    chips: listParam(['a', 'b']),
    stati: listParam(null),
    quote: textParam(),
    group: numberParam(),
    day: dayParam(),
    month: monthParam(),
    undated: flagParam(),
};
/** The values a bare address gives for the record, day, month and switch above */
const NONE = { quote: '', group: null, day: null, month: null, undated: false };

const DEFAULTS = { client: '', dateFrom: '2026-11-06', dateTo: '2026-11-06', complexOnly: false, year: 2026, statuses: ['done'] as string[] };
type Filters = typeof DEFAULTS;

const read = (query: string) => readAddress(VIEW, new URLSearchParams(query));
const patched = (query: string, patch: Parameters<typeof patchAddress<typeof VIEW>>[2]) => {
    const params = new URLSearchParams(query);
    patchAddress(VIEW, params, patch);
    return params.toString();
};
const filtersIn = (query: string) => readFilters(DEFAULTS, new URLSearchParams(query));
const written = (query: string, filters: Filters | null) => {
    const params = new URLSearchParams(query);
    writeFilters(params, DEFAULTS, filters);
    return params.toString();
};
const BLANK: Filters = { client: '', dateFrom: '', dateTo: '', complexOnly: false, year: 2026, statuses: [] };

const EXAMPLES: { name: string; expected: unknown; actual: () => unknown }[] = [
    // View values
    { name: 'a bare address gives every default', expected: { sheet: 'clz', sort: { column: 'value', direction: 'desc' }, page: 1, chips: ['a', 'b'], stati: null, ...NONE }, actual: () => read('') },
    { name: 'a record, a day, a month and a switch are read', expected: { quote: 'a1b2', group: 10, day: '2026-10-14', month: { year: 2026, month: 10 }, undated: true }, actual: () => { const { quote, group, day, month, undated } = read('quote=a1b2&group=10&day=2026-10-14&month=2026-10&undated=true'); return { quote, group, day, month, undated }; } },
    { name: 'a day, a month or a number that is not one counts as none', expected: { group: null, day: null, month: null }, actual: () => { const { group, day, month } = read('group=x&day=2026-13-40&month=2026-13'); return { group, day, month }; } },
    { name: 'a record, a day, a month and a switch are written; none of them leaves the address bare', expected: ['quote=a1b2&group=10&day=2026-10-14&month=2026-03&undated=true', ''], actual: () => [patched('', { quote: 'a1b2', group: 10, day: '2026-10-14', month: { year: 2026, month: 3 }, undated: true }), patched('quote=a1b2&group=10&day=2026-10-14&month=2026-03&undated=true', NONE)] },
    { name: 'a tab, an order and a page are read', expected: { sheet: 'interinali', sort: { column: 'client', direction: 'asc' }, page: 3 }, actual: () => { const { sheet, sort, page } = read('sheet=interinali&sort=client.asc&page=3'); return { sheet, sort, page }; } },
    { name: 'an unknown tab is the default one', expected: 'clz', actual: () => read('sheet=altro').sheet },
    { name: 'a page that is not a whole number from 1 is page 1', expected: [1, 1, 1, 1], actual: () => ['0', '-2', '1.5', 'x'].map((page) => read(`page=${page}`).page) },
    { name: 'a page too large to be exact is page 1, an infinite number is no number', expected: [1, 1, null, null], actual: () => [read('page=9007199254740993').page, read('page=Infinity').page, read('group=Infinity').group, read('group=1e400').group] },
    { name: 'an order without a direction is the default one', expected: { column: 'value', direction: 'desc' }, actual: () => read('sort=client').sort },
    { name: 'a column with a dot in its name keeps it', expected: { column: 'a.b', direction: 'asc' }, actual: () => read('sort=a.b.asc').sort },
    { name: 'a default value is left out of the address', expected: '', actual: () => patched('sheet=interinali&page=4', { sheet: 'clz', page: 1 }) },
    { name: 'a change keeps the other values', expected: 'client=ROSSI&page=2', actual: () => patched('client=ROSSI', { page: 2 }) },
    { name: 'the default order is left out, another is written', expected: ['', 'sort=value.asc'], actual: () => [patched('sort=x.asc', { sort: { column: 'value', direction: 'desc' } }), patched('', { sort: { column: 'value', direction: 'asc' } })] },
    { name: 'chips: the default set in any order is left out', expected: '', actual: () => patched('chips=a', { chips: ['b', 'a'] }) },
    { name: 'chips: none switched on is an empty value, read back as none', expected: ['chips=', []], actual: () => [patched('', { chips: [] }), read('chips=').chips] },
    { name: 'chips: the chip of "no value" is its own item', expected: ['stati=IN.-', ['IN', '']], actual: () => [patched('', { stati: ['IN', ''] }), read('stati=IN.-').stati] },
    { name: 'chips: back to "worked out by the screen" leaves them out', expected: '', actual: () => patched('stati=IN', { stati: null }) },
    { name: 'a list is written with dots', expected: 'done.skipped.OFF HR', actual: () => listText(['done', 'skipped', 'OFF HR']) },
    { name: 'a list keeps dots, percent signs, commas and a lone dash inside its items', expected: ['a.b', '100%', '-', '', 'OFF HR', 'a,b', 'x-y'], actual: () => textList(listText(['a.b', '100%', '-', '', 'OFF HR', 'a,b', 'x-y'])) },
    { name: 'a page and its query as a link', expected: ['/analytics/payroll-hours?year=2026', '/quotes'], actual: () => [addressOf('/analytics/payroll-hours', new URLSearchParams('year=2026')), addressOf('/quotes', new URLSearchParams())] },

    // The page to go back to after the login
    { name: 'after the login: a page of the app, with its query and anchor, is where one goes back', expected: ['/work-progress?order=2609537&tab=management', '/tasks/list/12#note', '/'], actual: () => ['/work-progress?order=2609537&tab=management', '/tasks/list/12#note', '/'].map(insideLink) },
    { name: 'after the login: another site, in every spelling a browser follows, is the home page', expected: ['/', '/', '/', '/', '/', '/'], actual: () => ['//altro.sito/login', '/\\altro.sito/login', '/\t/altro.sito', '/\n/altro.sito', 'http://altro.sito/', 'altro.sito'].map(insideLink) },
    { name: 'after the login: an /api address or something that is not a text is the home page', expected: ['/', '/', '/', '/', '/'], actual: () => ['/api/auto-exit', '/api', '/x/../api/auto-exit', undefined, 12].map(insideLink) },

    // Applied filters
    { name: 'a bare address has nothing applied', expected: null, actual: () => filtersIn('') },
    { name: 'view values alone apply nothing', expected: null, actual: () => filtersIn('sort=client.asc&page=2&sheet=clz') },
    { name: 'one filter in the address: the others are blank, a number keeps its default', expected: { ...BLANK, client: 'ROSSI' }, actual: () => filtersIn('client=ROSSI') },
    { name: 'an old bookmark reads as before', expected: { ...BLANK, dateFrom: '2026-10-01', dateTo: '2026-10-31', client: 'ROSSI', complexOnly: true }, actual: () => filtersIn('dateFrom=2026-10-01&dateTo=2026-10-31&client=ROSSI&complexOnly=true') },
    { name: 'a number and a list are read', expected: { year: 2025, statuses: ['done', 'skipped'] }, actual: () => { const found = filtersIn('year=2025&statuses=done.skipped'); return { year: found?.year, statuses: found?.statuses }; } },
    { name: 'a number that is not one keeps its default', expected: 2026, actual: () => filtersIn('year=abc')?.year },
    { name: 'writing leaves blanks out and always writes numbers', expected: 'client=ROSSI&year=2026', actual: () => written('', { ...BLANK, client: 'ROSSI' }) },
    { name: 'every filter blank still counts as applied', expected: ['applied=1', { ...BLANK, year: 2026 }], actual: () => { const none = { client: '' }; const params = new URLSearchParams(); writeFilters(params, none, none); return [params.toString(), filtersIn('applied=1')]; } },
    { name: 'writing replaces the old filters and keeps the view values, after the filters', expected: 'client=BIANCHI&year=2026&sort=client.asc&page=2', actual: () => written('sort=client.asc&client=ROSSI&complexOnly=true&page=2', { ...BLANK, client: 'BIANCHI' }) },
    { name: 'nothing applied takes every filter out', expected: 'sheet=interinali', actual: () => written('client=ROSSI&year=2025&applied=1&sheet=interinali', null) },
    { name: 'what is written is read back the same', expected: true, actual: () => { const filters: Filters = { client: 'A & B, C', dateFrom: '2026-01-01', dateTo: '', complexOnly: true, year: 2024, statuses: ['done', 'cancelled'] }; return filtersKey(filtersIn(written('', filters))) === filtersKey(filters); } },
    { name: 'the same filters give the same key, nothing applied gives none', expected: [true, ''], actual: () => [filtersKey(filtersIn('client=ROSSI&year=2026')) === filtersKey(filtersIn('year=2026&client=ROSSI&page=3')), filtersKey(filtersIn(''))] },
    { name: 'filters apart from the defaults are counted (a list in another order is the same)', expected: [0, 2, 0], actual: () => [countChangedFilters(DEFAULTS, DEFAULTS), countChangedFilters({ ...DEFAULTS, client: 'ROSSI', statuses: ['done', 'skipped'] }, DEFAULTS), countChangedFilters(null, DEFAULTS)] },
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
