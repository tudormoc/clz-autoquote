/**
 * What a screen shows, kept in the address bar (?dateFrom=2026-11-01&client=ROSSI&sort=value.desc&page=2&sheet=interinali),
 * so a link, a refresh, Back / Forward and a new tab all open the same view. Two kinds of values:
 *  - view values (tab, sort, page, chips …): one AddressParam each; a value equal to its default is left out;
 *  - the applied filters of a list: read by the kind of each default (text, number, yes / no, list); a blank one is
 *    left out. An address that holds none of them has nothing applied: the page waits for "Applica".
 * Pure: src/hooks/useAddress.ts and useAppliedFilters.ts read and write the real address with it.
 * Values are plain data (text, numbers, yes / no, lists, a sort): the hooks compare them as JSON.
 */
import { z } from 'zod';
import type { MonthPeriod } from '@/lib/dateUtils';
import type { SortState } from '@/lib/sort';

/** One view value in the address */
export interface AddressParam<T> {
    /** The value for this text of the address (null = not there) */
    read: (text: string | null) => T;
    /** The text for this value; null = left out of the address */
    write: (value: T) => string | null;
}

export type AddressShape = Record<string, AddressParam<any>>;
export type AddressValues<S extends AddressShape> = { [K in keyof S]: S[K] extends AddressParam<infer T> ? T : never };

/** A value checked by `schema`: anything else in the address counts as the default */
function checkedParam<T extends string | number>(schema: z.ZodType<T>, fallback: T): AddressParam<T> {
    return {
        read: (text) => {
            const parsed = text === null ? null : schema.safeParse(text);
            return parsed?.success ? parsed.data : fallback;
        },
        write: (value) => (value === fallback ? null : String(value)),
    };
}

/** A number written as text; Zod's number is never infinite ("Infinity", "1e400") */
const NUMBER = z.string().trim().min(1).pipe(z.coerce.number<string>());
const toNumber = (text: string | null): number | null => {
    const parsed = NUMBER.safeParse(text);
    return parsed.success ? parsed.data : null;
};

/** A free text, such as the id of the record shown; '' = none */
export const textParam = (): AddressParam<string> => ({ read: (text) => text ?? '', write: (value) => value || null });

/** Something switched on; off is left out */
export const flagParam = (): AddressParam<boolean> => ({ read: (text) => text === 'true', write: (on) => (on ? 'true' : null) });

/** One of `values` (a tab, a sheet) */
export function choiceParam<V extends string>(values: readonly V[], fallback: V): AddressParam<V> {
    return checkedParam(z.custom<V>((value) => values.includes(value as V)), fallback);
}

/** A number, such as the code of the record shown; null = none */
export const numberParam = (): AddressParam<number | null> => ({ read: toNumber, write: (value) => (value === null ? null : String(value)) });

const DAY = z.string().date();

/** A day as "2026-10-14"; null = none, or the one the screen starts on (today) */
export const dayParam = (): AddressParam<string | null> => ({
    read: (text) => (DAY.safeParse(text).success ? text : null),
    write: (day) => day,
});

/** A month as "2026-10"; null = the one the screen starts on (this month) */
export const monthParam = (): AddressParam<MonthPeriod | null> => ({
    read: (text) => {
        const found = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(text ?? '');
        return found ? { year: Number(found[1]), month: Number(found[2]) } : null;
    },
    write: (period) => (period ? `${period.year}-${String(period.month).padStart(2, '0')}` : null),
});

/** The page of a paged list, from 1 */
export const pageParam = (): AddressParam<number> => checkedParam(NUMBER.pipe(z.number().int().min(1)), 1);

const DIRECTION = z.enum(['asc', 'desc']);
const sortText = (sort: SortState | null) => (sort ? `${sort.column}.${sort.direction}` : '');

/** The order of a list as "column.asc" / "column.desc" */
export function sortParam(fallback: SortState | null): AddressParam<SortState | null> {
    return {
        read: (text) => {
            const cut = text?.lastIndexOf('.') ?? -1;
            const direction = DIRECTION.safeParse(text?.slice(cut + 1));
            return text && cut > 0 && direction.success ? { column: text.slice(0, cut), direction: direction.data } : fallback;
        },
        write: (sort) => {
            const text = sortText(sort);
            return text && text !== sortText(fallback) ? text : null;
        },
    };
}

/** Items are joined by dots, which an address shows as they are (a comma would become %2C) */
const SEPARATOR = '.';
/** Stands for an empty item, so an empty text is the empty list */
const EMPTY_ITEM = '-';
const escapeChar = (char: string) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`;
const escapeItem = (item: string) => (item === EMPTY_ITEM ? escapeChar(item) : item.replace(/[%.]/g, escapeChar));
const unescapeItem = (item: string) => item.replace(/%([0-9A-Fa-f]{2})/g, (_match, hex: string) => String.fromCharCode(parseInt(hex, 16)));

/** A list as one text: "done.skipped" */
export const listText = (items: readonly string[]) => items.map((item) => (item === '' ? EMPTY_ITEM : escapeItem(item))).join(SEPARATOR);
export const textList = (text: string): string[] => (text === '' ? [] : text.split(SEPARATOR).map((item) => (item === EMPTY_ITEM ? '' : unescapeItem(item))));

const sameItems = (a: readonly string[] | null, b: readonly string[] | null) =>
    a === b || (a !== null && b !== null && a.length === b.length && [...a].sort().join('\n') === [...b].sort().join('\n'));

/** The chips switched on, in any order; `fallback` null = a default the screen works out itself (e.g. every chip on) */
export function listParam<L extends readonly string[] | null>(fallback: L): AddressParam<readonly string[] | L> {
    return {
        read: (text) => (text === null ? fallback : textList(text)),
        write: (items) => (items === null || sameItems(items, fallback) ? null : listText(items)),
    };
}

export function readAddress<S extends AddressShape>(shape: S, params: URLSearchParams): AddressValues<S> {
    return Object.fromEntries(Object.entries(shape).map(([key, param]) => [key, param.read(params.get(key))])) as AddressValues<S>;
}

/** Puts the values of `patch` in `params`; the other values stay as they are */
export function patchAddress<S extends AddressShape>(shape: S, params: URLSearchParams, patch: Partial<AddressValues<S>>): void {
    for (const [key, value] of Object.entries(patch)) {
        const text = shape[key].write(value);
        if (text === null) params.delete(key);
        else params.set(key, text);
    }
}

/** A page and its query as a link */
export function addressOf(pathname: string, params: URLSearchParams): string {
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
}

/** A made-up site to read a link against: a link that leaves it is not one of the app's */
const INSIDE = 'http://app.invalid';

/**
 * A link somebody handed over (the page to go back to after the login) as a link inside the app: its page, query and
 * anchor, or the home page when it is anything else. Refused: another site in every spelling a browser follows
 * ("//host", "/\host", a tab or line break inside) and the /api addresses, which are not pages.
 */
export function insideLink(link: unknown): string {
    if (typeof link !== 'string' || !link.startsWith('/') || /[\\\u0000-\u001f\u007f]/.test(link)) return '/';
    try {
        const url = new URL(link, INSIDE);
        if (url.origin !== INSIDE || url.pathname === '/api' || url.pathname.startsWith('/api/')) return '/';
        return `${url.pathname}${url.search}${url.hash}`;
    } catch {
        return '/';
    }
}

// ── Applied filters ────────────────────────────────────────────────────────────────────────────────────────────────

type FilterValue = string | number | boolean | readonly string[];

const isList = (value: unknown): value is readonly string[] => Array.isArray(value);
const isFilterValue = (value: unknown): value is FilterValue =>
    typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || isList(value);

/** In the address when "Applica" was pressed with every filter blank, so the list still counts as applied */
const APPLIED_MARK = 'applied';

/** The filter object of a list as name → value */
const entries = (filters: unknown): [string, unknown][] => Object.entries(filters as Record<string, unknown>);

/**
 * The filters applied in the address, or null when it holds none of them. `defaults` says which filters there are and of
 * what kind; a filter that is not in an address with others is blank ('' / no / empty list), a number keeps its default.
 */
export function readFilters<F>(defaults: F, params: URLSearchParams): F | null {
    const kinds = entries(defaults);
    if (!params.has(APPLIED_MARK) && !kinds.some(([key, fallback]) => isFilterValue(fallback) && params.has(key))) return null;
    const found: Record<string, unknown> = {};
    for (const [key, fallback] of kinds) {
        const text = params.get(key);
        if (typeof fallback === 'string') found[key] = text ?? '';
        else if (typeof fallback === 'boolean') found[key] = text === 'true';
        else if (typeof fallback === 'number') found[key] = toNumber(text) ?? fallback;
        else if (isList(fallback)) found[key] = text === null ? [] : textList(text);
        else found[key] = fallback;
    }
    return found as F;
}

/** Puts the applied filters in `params` (null = none applied), before the view values, which stay as they are */
export function writeFilters<F>(params: URLSearchParams, defaults: F, filters: F | null): void {
    const filterKeys = new Set([APPLIED_MARK, ...entries(defaults).flatMap(([key, fallback]) => (isFilterValue(fallback) ? [key] : []))]);
    const viewValues = [...params].filter(([key]) => !filterKeys.has(key));
    for (const key of [...params.keys()]) params.delete(key);
    if (filters) {
        for (const [key, value] of entries(filters)) {
            if (!isFilterValue(value) || value === '' || value === false || (isList(value) && value.length === 0)) continue;
            params.set(key, isList(value) ? listText(value) : String(value));
        }
        if (params.size === 0) params.set(APPLIED_MARK, '1');
    }
    for (const [key, value] of viewValues) params.append(key, value);
}

/** The applied filters as one text, '' when none: two addresses with the same key show the same list */
export const filtersKey = (filters: unknown): string => (filters ? JSON.stringify(filters) : '');

/** How many filters differ from their defaults (shown on the folded filter bar) */
export function countChangedFilters<F>(filters: F | null, defaults: F): number {
    if (!filters) return 0;
    const base = new Map(entries(defaults));
    return entries(filters).filter(([key, value]) => {
        const fallback = base.get(key);
        if (isList(value)) return !isList(fallback) || !sameItems(value, fallback);
        return isFilterValue(value) && value !== fallback;
    }).length;
}
