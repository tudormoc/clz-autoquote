/**
 * Regression check for the date helpers (src/lib/dateUtils.ts): the ready-made periods of the filters around
 * made-up "today"s (turn of the month, of the year), the years a year filter offers, the local date text, and the
 * date arithmetic every area shares (day of the week, plus days and months, ranges, months), also across the nights
 * the clocks change.
 *
 *   npm run dates:examples
 */
import {
    DATE_PERIODS,
    addDays,
    addMonths,
    daysBetween,
    eachDateInRange,
    isIsoDate,
    isoWeekStart,
    makeDate,
    monthDates,
    monthRange,
    periodOf,
    periodRange,
    recentYears,
    shiftMonthPeriod,
    toIsoDate,
    weekStart,
    weekdayOf,
} from '@/lib/dateUtils';

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
    { name: 'ISO week 1 of 2026 starts in the year before (Monday 29 December 2025)', expected: '2025-12-29', actual: () => toIsoDate(isoWeekStart(2026, 1)) },

    // The one date arithmetic of the app, on "YYYY-MM-DD" strings (reports, Agenda, presence rules)
    { name: 'day of the week: Monday is 1, Sunday is 7', expected: [1, 4, 6, 7], actual: () => ['2026-11-09', '2026-11-12', '2026-11-14', '2026-11-15'].map(weekdayOf) },
    { name: 'Monday of a date\'s week, also across a month and a year', expected: ['2026-11-09', '2026-10-26', '2025-12-29'], actual: () => ['2026-11-12', '2026-11-01', '2026-01-01'].map(weekStart) },
    { name: 'a date plus days, across the night the clocks change', expected: ['2026-03-29', '2026-03-30', '2026-10-26', '2026-02-28'], actual: () => [addDays('2026-03-28', 1), addDays('2026-03-29', 1), addDays('2026-10-25', 1), addDays('2026-03-01', -1)] },
    { name: 'days between two dates, across the clock change and backwards', expected: [3, -3, 365], actual: () => [daysBetween('2026-03-28', '2026-03-31'), daysBetween('2026-03-31', '2026-03-28'), daysBetween('2026-01-01', '2027-01-01')] },
    { name: 'a date plus months: the end of a longer month becomes the end of the shorter one', expected: ['2026-02-28', '2028-02-29', '2025-11-30', '2027-01-15'], actual: () => [addMonths('2026-01-31', 1), addMonths('2028-01-31', 1), addMonths('2026-01-31', -2), addMonths('2026-11-15', 2)] },
    { name: 'a date from year, month, day: a day past the month\'s end is its last day', expected: ['2026-04-30', '2026-02-28', '2028-02-29'], actual: () => [makeDate(2026, 4, 31), makeDate(2026, 2, 30), makeDate(2028, 2, 30)] },
    { name: 'a real date, and what is not one', expected: [true, false, false, false, false], actual: () => ['2026-11-12', '2026-02-30', '2026-1-5', '', null].map(isIsoDate) },
    { name: 'every date of a range, the ends included, across the clock change', expected: ['2026-03-28', '2026-03-29', '2026-03-30'], actual: () => eachDateInRange('2026-03-28', '2026-03-30') },
    { name: 'a range of one day, a range that ends before it starts', expected: [['2026-11-12'], []], actual: () => [eachDateInRange('2026-11-12', '2026-11-12'), eachDateInRange('2026-11-12', '2026-11-11')] },
    { name: 'a range with an end that is not a real date has no days (an empty filter, 30 February)', expected: [[], [], [], []], actual: () => [eachDateInRange('', ''), eachDateInRange('2026-11-01', ''), eachDateInRange('2026-02-30', '2026-03-05'), eachDateInRange('26-01-05', '2026-01-10')] },
    { name: 'first and last day of a month, February of a leap year too', expected: [{ dateFrom: '2026-11-01', dateTo: '2026-11-30' }, { dateFrom: '2028-02-01', dateTo: '2028-02-29' }, { dateFrom: '2026-02-01', dateTo: '2026-02-28' }], actual: () => [monthRange(2026, 11), monthRange(2028, 2), monthRange(2026, 2)] },
    { name: 'every day of a month: as many as the month has, first to last', expected: [[30, '2026-11-01', '2026-11-30'], [29, '2028-02-01', '2028-02-29']], actual: () => [monthDates(2026, 11), monthDates(2028, 2)].map((days) => [days.length, days[0], days[days.length - 1]]) },
    { name: 'a month moved: forwards over the year, backwards over the year, by more than a year', expected: [{ year: 2027, month: 1 }, { year: 2025, month: 12 }, { year: 2028, month: 2 }], actual: () => [shiftMonthPeriod({ year: 2026, month: 12 }, 1), shiftMonthPeriod({ year: 2026, month: 1 }, -1), shiftMonthPeriod({ year: 2026, month: 11 }, 15)] },
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
