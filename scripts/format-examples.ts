/**
 * Checks src/lib/format.ts against the formatters it replaced.
 * Run: npm run format:examples
 */
import { formatCurrency, formatCurrencyRounded, formatDate, formatDayMonth, formatDbDateTime, formatHours, formatNumber } from '@/lib/format';
import { toIsoDate } from '@/lib/dateUtils';

let failures = 0;
let passes = 0;
function expect(label: string, actual: string, expected: string) {
    if (actual === expected) {
        passes++;
    } else {
        failures++;
        console.log(`FAIL ${label}: got "${actual}", expected "${expected}"`);
    }
}

// Old per-component implementations — new formatters must match them, except that every number now
// gets a thousands separator (useGrouping 'always': "5.186 €" instead of the Italian default "5186 €")
const oldCurrency = (v: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, useGrouping: 'always' }).format(v);
const oldCurrencyRounded = (v: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0, useGrouping: 'always' }).format(Math.round(v));
const oldTime = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}:${m.toString().padStart(2, '0')}`;
};

const amounts = [0, 0.004, 0.005, 1, 12.5, 999.999, 1234.5, -1234.5, 1e6 + 0.49, -0.01, 563294.123];
for (const v of amounts) {
    expect(`formatCurrency(${v})`, formatCurrency(v), oldCurrency(v));
    expect(`formatCurrencyRounded(${v})`, formatCurrencyRounded(v), oldCurrencyRounded(v));
}

// Hours: identical to the old formatter except where it printed ":60"
for (let i = 0; i <= 2000; i++) {
    const hours = i / 37;
    const old = oldTime(hours);
    if (!old.endsWith(':60')) expect(`formatHours(${hours})`, formatHours(hours), old);
}
expect('formatHours(1.999) — old printed 1:60', formatHours(1.999), '2:00');
expect('formatHours(-0.5)', formatHours(-0.5), '-0:30');
expect('formatHours(null)', formatHours(null), '-');

expect('formatNumber(1234567)', formatNumber(1234567), '1.234.567');
expect('formatNumber(12345.678, 2)', formatNumber(12345.678, 2), '12.345,68');
expect('formatNumber(5186) — 4 digits grouped', formatNumber(5186), '5.186');
expect('formatCurrencyRounded(5186)', formatCurrencyRounded(5186), '5.186 €'); // Intl puts a no-break space before €
expect('formatCurrency(1234.5)', formatCurrency(1234.5), '1.234,50 €');
expect('formatNumber(undefined)', formatNumber(undefined), '-');

expect('formatDate(iso)', formatDate('2026-10-06'), '06/10/2026');
expect('formatDate(datetime)', formatDate('2026-01-09T14:30:00'), '09/01/2026');
expect('formatDbDateTime(Date)', formatDbDateTime(new Date('2026-10-06T17:35:09.000Z')), '06/10/2026, 17:35:09');
expect('formatDbDateTime(string)', formatDbDateTime('2026-01-09T07:05:00.000Z'), '09/01/2026, 07:05:00');
expect('formatDbDateTime(invalid)', formatDbDateTime('not a date'), '-');
expect('formatDate(Date)', formatDate(new Date(2026, 11, 31)), '31/12/2026');
expect('formatDate(empty)', formatDate(''), '-');
expect('formatDate(invalid)', formatDate('not a date'), '-');
expect('formatDayMonth', formatDayMonth('2026-03-09'), '09/03');

expect('toIsoDate local midnight', toIsoDate(new Date(2026, 9, 6, 0, 30)), '2026-10-06');
expect('toIsoDate end of year', toIsoDate(new Date(2026, 11, 31, 23, 59)), '2026-12-31');

console.log(`\n${passes}/${passes + failures} format examples pass`);
if (failures) process.exit(1);
