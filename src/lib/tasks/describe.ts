/**
 * Repeat rules and due dates in words ("Ogni mese, il 16", "3 mesi dopo l'ultima volta", "tra 3 giorni").
 */

import { formatDate, formatDayMonth } from '@/lib/format';
import { addDays, daysBetween, dayOf, monthOf, weekdayOf, yearOf } from '@/lib/tasks/dates';
import type { MonthDay, RepeatEnd, RepeatPattern, RepeatRule } from '@/lib/tasks/repeat';
import { APP_COPY, fmt } from '@/locales';

const copy = APP_COPY.tasks.repeat;
const SUNDAY = 7;

const plural = (forms: { one: string; many: string }, n: number) => fmt(n === 1 ? forms.one : forms.many, { n });

/** "16, 30 e 31" */
function joinList(items: string[]): string {
    if (items.length <= 1) return items.join('');
    return `${items.slice(0, -1).join(', ')}${copy.and}${items.at(-1)}`;
}

function monthDayText(on: MonthDay): string {
    if (on.type === 'last') return copy.lastDay;
    if (on.type === 'days') return fmt(copy.onDays, { days: joinList(Array.from(new Set(on.days)).sort((a, b) => a - b).map(String)) });
    const feminine = on.weekday === SUNDAY;
    const nth = String(on.nth) as keyof typeof copy.ordinals;
    return fmt(copy.nthWeekday, {
        nth: (feminine ? copy.ordinalsFeminine : copy.ordinals)[nth],
        weekday: APP_COPY.weekdays.long[on.weekday - 1].toLowerCase(),
    });
}

function patternText(pattern: RepeatPattern): string {
    switch (pattern.unit) {
        case 'days':
            return plural(copy.everyDays, pattern.every);
        case 'weeks': {
            const days = Array.from(new Set(pattern.weekdays)).sort((a, b) => a - b).map((d) => APP_COPY.weekdays.short[d - 1].toLowerCase());
            return `${plural(copy.everyWeeks, pattern.every)}, ${joinList(days)}`;
        }
        case 'months':
            return `${plural(copy.everyMonths, pattern.every)}, ${monthDayText(pattern.on)}`;
        case 'years': {
            const dates = pattern.dates.map((d) => `${String(d.day).padStart(2, '0')}/${String(d.month).padStart(2, '0')}`);
            return `${plural(copy.everyYears, pattern.every)}, ${fmt(copy.onDates, { dates: joinList(dates) })}`;
        }
    }
}

function endText(end: RepeatEnd): string | null {
    if (end.type === 'until') return fmt(copy.until, { date: formatDate(`${end.date}T00:00:00`) });
    if (end.type === 'count') return fmt(copy.count, { count: end.count });
    return null;
}

/** The rule in one line; null rule = "Una volta" */
export function describeRepeat(rule: RepeatRule | null): string {
    if (!rule) return copy.once;
    const parts =
        rule.mode === 'calendar'
            ? [patternText(rule.pattern), rule.missed === 'latest' ? copy.latestOnly : null]
            : [fmt(copy.after, { every: plural(copy.units[rule.unit], rule.every) })];
    return [...parts, endText(rule.end)].filter(Boolean).join(', ');
}

/** "YYYY-MM-DD" → "16/11/2026" */
export const formatIsoDate = (iso: string | null | undefined) => (iso ? formatDate(`${iso}T00:00:00`) : formatDate(null));

/** "YYYY-MM-DD HH:MM:SS" (server wall-clock time, as the Agenda reads it) → "16/11/2026, 09:15" */
export function formatMoment(moment: string | null | undefined): string {
    if (!moment) return formatDate(null);
    return `${formatIsoDate(moment.slice(0, 10))}, ${moment.slice(11, 16)}`;
}

/** "YYYY-MM-DD" → "lun 16/11" */
export const formatShortDay = (iso: string) => `${APP_COPY.weekdays.short[weekdayOf(iso) - 1].toLowerCase()} ${formatDayMonth(iso)}`;

/** "oggi", "domani", "tra 3 giorni", "ieri", "3 giorni fa" */
export function relativeDay(iso: string, today: string): string {
    const when = APP_COPY.tasks.when;
    const days = daysBetween(today, iso);
    if (days === 0) return when.today;
    if (days === 1) return when.tomorrow;
    if (days === -1) return when.yesterday;
    return days > 0 ? fmt(when.inDays, { n: days }) : fmt(when.daysAgo, { n: -days });
}

/** "12 – 18 ottobre 2026", "28 settembre – 4 ottobre 2026", "29 dicembre 2025 – 4 gennaio 2026" */
export function weekTitle(monday: string): string {
    const sunday = addDays(monday, 6);
    const month = (iso: string) => APP_COPY.months.long[monthOf(iso) - 1].toLowerCase();
    if (yearOf(monday) !== yearOf(sunday)) return `${dayOf(monday)} ${month(monday)} ${yearOf(monday)} – ${dayOf(sunday)} ${month(sunday)} ${yearOf(sunday)}`;
    if (monthOf(monday) !== monthOf(sunday)) return `${dayOf(monday)} ${month(monday)} – ${dayOf(sunday)} ${month(sunday)} ${yearOf(sunday)}`;
    return `${dayOf(monday)} – ${dayOf(sunday)} ${month(sunday)} ${yearOf(sunday)}`;
}
