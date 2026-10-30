/**
 * Regression check for the date helpers (src/lib/dateUtils.ts): the ready-made periods of the filters around
 * made-up "today"s (turn of the month, of the year), the years a year filter offers, the local date text.
 *
 *   npm run dates:examples
 */
import { DATE_PERIODS, isoWeekStart, periodOf, periodRange, recentYears, toIsoDate } from '@/lib/dateUtils';

const day = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d, 12);
};

const EXAMPLES: { name: string; expected: unknown; actual: () => unknown }[] = [
    { name: 'the periods offered, in order', expected: ['lastWeek', 'lastMonth', 'lastYear'], actual: () => [...DATE_PERIODS] },
    { name: 'last week on a Friday: Monday to Sunday before', expected: { dateFrom: '2026-10-19', dateTo: '2026-10-25' }, actual: () => periodRange('lastWeek', day('2026-10-30')) },
    { name: 'last week on a Monday', expected: { dateFrom: '2026-10-19', dateTo: '2026-10-25' }, actual: () => periodRange('lastWeek', day('2026-10-26')) },
    { name: 'last week on a Sunday', expected: { dateFrom: '2026-10-19', dateTo: '2026-10-25' }, actual: () => periodRange('lastWeek', day('2026-11-01')) },
    { name: 'last week across the turn of the year', expected: { dateFrom: '2026-12-28', dateTo: '2027-01-03' }, actual: () => periodRange('lastWeek', day('2027-01-06')) },
    { name: 'last month in March (February, leap year 2028)', expected: { dateFrom: '2028-02-01', dateTo: '2028-02-29' }, actual: () => periodRange('lastMonth', day('2028-03-15')) },
    { name: 'last month in January is December before', expected: { dateFrom: '2025-12-01', dateTo: '2025-12-31' }, actual: () => periodRange('lastMonth', day('2026-01-10')) },
    { name: 'last year', expected: { dateFrom: '2025-01-01', dateTo: '2025-12-31' }, actual: () => periodRange('lastYear', day('2026-10-30')) },
    { name: 'the dates of a period are recognised', expected: 'lastMonth', actual: () => periodOf({ dateFrom: '2026-09-01', dateTo: '2026-09-30' }, day('2026-10-30')) },
    { name: 'other dates are custom', expected: null, actual: () => periodOf({ dateFrom: '2026-10-30', dateTo: '2026-10-30' }, day('2026-10-30')) },
    { name: 'years offered: this one and the two before', expected: [2026, 2025, 2024], actual: () => recentYears(3, day('2026-10-30')) },
    { name: 'a local date never shifts to the day before', expected: '2026-10-30', actual: () => toIsoDate(new Date(2026, 9, 30, 0, 30)) },
    { name: 'ISO week 1 of 2027 starts on Monday 4 January', expected: '2027-01-04', actual: () => toIsoDate(isoWeekStart(2027, 1)) },
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
