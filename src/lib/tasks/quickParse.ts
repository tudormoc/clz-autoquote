/**
 * The quick add line read as Italian: "Pagare F24 venerdì alle 10" → title "Pagare F24", the coming Friday, 10:00;
 * "Backup ogni lunedì" → a task repeating every Monday. Pure. The words it knows are in it.ts (tasks.quickWords,
 * weekdays, months); the date words are taken out of the title. What it does not understand stays in the title.
 */

import { foldText } from '@/lib/utils';
import { addDays, addMonths, dayOf, daysInMonth, makeDate, monthOf, weekStart, weekdayOf, yearOf } from '@/lib/tasks/dates';
import { RepeatRuleSchema, type RepeatRule } from '@/lib/tasks/repeat';
import { APP_COPY } from '@/locales';

const words = APP_COPY.tasks.quickWords;

export interface QuickEntry {
    title: string;
    dueDate: string | null;
    /** "HH:MM" */
    dueTime: string | null;
    repeat: RepeatRule | null;
}

type Unit = keyof typeof words.units;

// ---- Building the patterns: lower case, accents optional ("lunedi" = "lunedì") -------------------------------------

const ACCENTS: Record<string, string> = { a: '[aà]', e: '[eèé]', i: '[iì]', o: '[oò]', u: '[uù]' };
/** A word or phrase as a pattern: any accents, any spaces between words */
const word = (text: string) =>
    foldText(text)
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/[aeiou]/g, (vowel) => ACCENTS[vowel])
        .replace(/\s+/g, '\\s+');
/** One of several words, the longest first */
const anyOf = (list: readonly string[]) => `(?:${[...list].sort((a, b) => b.length - a.length).map(word).join('|')})`;
/** Not inside a longer word or number */
const whole = (pattern: string) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${pattern})(?![\\p{L}\\p{N}])`, 'iu');

const WEEKDAYS = APP_COPY.weekdays.long.map((name, index) => ({ day: index + 1, names: [name, ...(index + 1 in words.weekdayPlurals ? [words.weekdayPlurals[(index + 1) as 6 | 7]] : [])] }));
const WEEKDAY = anyOf(WEEKDAYS.flatMap((weekday) => weekday.names));
const MONTH = anyOf([...APP_COPY.months.long, ...APP_COPY.months.short]);
const NUMBER = `(?:\\d{1,3}|${anyOf(Object.keys(words.numbers))})`;
const UNIT = anyOf(Object.values(words.units).flat());
const BEFORE = `(?:${anyOf(words.before)}\\s+)?`;

const weekdayOfName = (name: string) => WEEKDAYS.find((weekday) => weekday.names.some((known) => foldText(known) === foldText(name)))?.day ?? 0;
const monthOfName = (name: string) => {
    const index = [...APP_COPY.months.long, ...APP_COPY.months.short].findIndex((known) => foldText(known) === foldText(name));
    return index < 0 ? 0 : (index % 12) + 1;
};
const numberOf = (text: string) => (/^\d+$/.test(text) ? Number(text) : (words.numbers as Record<string, number>)[foldText(text)] ?? 0);
const unitOf = (text: string): Unit => (Object.keys(words.units) as Unit[]).find((unit) => words.units[unit].some((known) => foldText(known) === foldText(text))) ?? 'days';

/** The first day on or after `from` that falls on one of the weekdays */
const nextWeekday = (from: string, weekdays: number[]) => {
    for (let day = from; ; day = addDays(day, 1)) if (weekdays.includes(weekdayOf(day))) return day;
};

/** A real date from day / month / year, or null (31/02); without a year the next one to come */
function dayMonth(day: number, month: number, year: number | null, today: string): string | null {
    if (month < 1 || month > 12 || day < 1) return null;
    const full = year === null ? yearOf(today) : year < 100 ? 2000 + year : year;
    if (day > daysInMonth(full, month)) return null;
    const date = makeDate(full, month, day);
    return year === null && date < today ? makeDate(full + 1, month, Math.min(day, daysInMonth(full + 1, month))) : date;
}

// ---- The expressions, tried in this order; each one found is taken out of the text ---------------------------------

const EVERY = anyOf(words.every);
const REPEAT_WEEKDAYS = whole(`${EVERY}\\s+(${WEEKDAY}(?:\\s*(?:,|\\se)\\s*${WEEKDAY})*)`);
const REPEAT_UNIT = whole(`${EVERY}\\s+(?:(${NUMBER})\\s+)?(${UNIT})`);
const TIME = whole(`${anyOf(words.at)}\\s*(\\d{1,2})(?:[:.](\\d{2}))?`);

/** Date expressions: each answers the date, or null when the words are not a real date */
const DATES: { pattern: RegExp; date: (match: RegExpExecArray, today: string) => string | null }[] = [
    { pattern: whole(`${BEFORE}${word(words.afterTomorrow)}`), date: (_, today) => addDays(today, 2) },
    { pattern: whole(`${BEFORE}${word(words.tomorrow)}`), date: (_, today) => addDays(today, 1) },
    { pattern: whole(`${BEFORE}${word(words.today)}`), date: (_, today) => today },
    {
        pattern: whole(`${anyOf(words.within)}\\s+(${NUMBER})\\s+(${UNIT})`),
        date: ([, count, unit], today) => {
            const n = numberOf(count);
            const kind = unitOf(unit);
            if (n < 1) return null;
            return kind === 'days' ? addDays(today, n) : kind === 'weeks' ? addDays(today, n * 7) : addMonths(today, kind === 'months' ? n : n * 12);
        },
    },
    { pattern: whole(`${BEFORE}${anyOf(words.nextWeek)}`), date: (_, today) => addDays(weekStart(today), 7) },
    {
        pattern: whole(`${BEFORE}(\\d{1,2})[/.](\\d{1,2})(?:[/.](\\d{4}|\\d{2}))?`),
        date: ([, day, month, year], today) => dayMonth(Number(day), Number(month), year ? Number(year) : null, today),
    },
    {
        pattern: whole(`${BEFORE}(\\d{1,2})\\s+(${MONTH})(?:\\s+(\\d{4}))?`),
        date: ([, day, month, year], today) => dayMonth(Number(day), monthOfName(month), year ? Number(year) : null, today),
    },
    // A weekday alone is the coming one, never today ("venerdì" said on a Friday = next week)
    { pattern: whole(`${BEFORE}(${WEEKDAY})(?:\\s+${anyOf(words.next)})?`), date: ([, name], today) => nextWeekday(addDays(today, 1), [weekdayOfName(name)]) },
    {
        pattern: whole(`${word(words.dayOfMonth)}\\s+(\\d{1,2})`),
        date: ([, day], today) => {
            const thisMonth = dayMonth(Number(day), monthOf(today), yearOf(today), today);
            if (thisMonth && thisMonth >= today) return thisMonth;
            const next = addMonths(`${today.slice(0, 7)}-01`, 1);
            return dayMonth(Number(day), monthOf(next), yearOf(next), today);
        },
    },
];

/** Takes the first match of `pattern` out of the text (answers it, or null) */
function take(state: { text: string }, pattern: RegExp): RegExpExecArray | null {
    const match = pattern.exec(state.text);
    if (match) state.text = `${state.text.slice(0, match.index)} ${state.text.slice(match.index + match[0].length)}`;
    return match;
}

const calendarRule = (pattern: Extract<RepeatRule, { mode: 'calendar' }>['pattern']): RepeatRule => ({ mode: 'calendar', pattern, missed: 'keep', end: { type: 'never' } });

/** Reads the line; a line that is only date words keeps all its words as title */
export function parseQuickEntry(line: string, today: string): QuickEntry {
    const state = { text: line };
    let repeatWeekdays: number[] | null = null;
    let repeatUnit: { every: number; unit: Unit } | null = null;

    const weekdays = take(state, REPEAT_WEEKDAYS);
    if (weekdays) {
        const names = weekdays[1].split(/\s*(?:,|\se)\s*/);
        repeatWeekdays = Array.from(new Set(names.map(weekdayOfName).filter((day) => day > 0))).sort();
    } else {
        const unit = take(state, REPEAT_UNIT);
        if (unit) repeatUnit = { every: unit[1] ? numberOf(unit[1]) : 1, unit: unitOf(unit[2]) };
    }

    const beforeTime = state.text;
    const time = take(state, TIME);
    const hours = time ? Number(time[1]) : -1;
    const minutes = time?.[2] ? Number(time[2]) : 0;
    const dueTime = hours >= 0 && hours < 24 && minutes < 60 ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}` : null;
    if (time && !dueTime) state.text = beforeTime; // "alle 27": not a time, leave the words alone

    let dueDate: string | null = null;
    for (const { pattern, date } of DATES) {
        const before = state.text;
        const match = take(state, pattern);
        if (!match) continue;
        dueDate = date(match, today);
        if (!dueDate) state.text = before;
        break;
    }

    let repeat: RepeatRule | null = null;
    if (repeatWeekdays && repeatWeekdays.length > 0) {
        dueDate = dueDate && repeatWeekdays.includes(weekdayOf(dueDate)) ? dueDate : nextWeekday(dueDate ?? today, repeatWeekdays);
        repeat = calendarRule({ unit: 'weeks', every: 1, weekdays: repeatWeekdays });
    } else if (repeatUnit) {
        const first = dueDate ?? today;
        dueDate = first;
        const { every, unit } = repeatUnit;
        repeat = calendarRule(
            unit === 'days'
                ? { unit, every }
                : unit === 'weeks'
                  ? { unit, every, weekdays: [weekdayOf(first)] }
                  : unit === 'months'
                    ? { unit, every, on: { type: 'days', days: [dayOf(first)] } }
                    : { unit, every, dates: [{ month: monthOf(first), day: dayOf(first) }] }
        );
    }
    // "ogni 400 giorni" is past what a rule allows: nothing understood
    if (repeat && !RepeatRuleSchema.safeParse(repeat).success) return { title: line.trim(), dueDate: null, dueTime: null, repeat: null };

    // Commas, dashes and spaces left where the words were; a capital letter stays first ("Lunedì riunione" → "Riunione")
    const rest = state.text.replace(/\s+/g, ' ').replace(/^[\s,;:–-]+|[\s,;:–-]+$/g, '').trim();
    const capital = line.trim().charAt(0);
    const title = capital && capital === capital.toUpperCase() && capital !== capital.toLowerCase() ? rest.charAt(0).toUpperCase() + rest.slice(1) : rest;
    if (!title || (!dueDate && !dueTime && !repeat)) return { title: line.trim(), dueDate: null, dueTime: null, repeat: null };
    return { title, dueDate: dueDate ?? (dueTime ? today : null), dueTime, repeat };
}
