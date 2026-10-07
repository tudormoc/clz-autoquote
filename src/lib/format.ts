/**
 * Display formatters — the one place where numbers, money, hours and dates become text.
 *
 * Intl formatters are expensive to create, so each one is built once and reused
 * (large tables call these thousands of times per render).
 */
import { APP_CONFIG } from '@/config/constants';
import { dbDateTimeParts } from '@/lib/dateUtils';
import { APP_COPY } from '@/locales';

const { LANGUAGE, CURRENCY } = APP_CONFIG.LOCALE;

/** Placeholder shown for missing values */
export const EMPTY_VALUE = '-';

// Thousands separator on every number, also 4-digit ones (Italian default omits it: "5186" next to "12.582")
const GROUPING = { useGrouping: 'always' } as const;

const currencyFormatters = new Map<number, Intl.NumberFormat>();
const numberFormatters = new Map<number, Intl.NumberFormat>();

function currencyFormatter(decimals: number) {
    let f = currencyFormatters.get(decimals);
    if (!f) {
        f = new Intl.NumberFormat(LANGUAGE, {
            style: 'currency',
            currency: CURRENCY,
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
            ...GROUPING,
        });
        currencyFormatters.set(decimals, f);
    }
    return f;
}

function numberFormatter(decimals: number) {
    let f = numberFormatters.get(decimals);
    if (!f) {
        f = new Intl.NumberFormat(LANGUAGE, { maximumFractionDigits: decimals, ...GROUPING });
        numberFormatters.set(decimals, f);
    }
    return f;
}

const isMissing = (value: number | null | undefined): value is null | undefined =>
    value === null || value === undefined || Number.isNaN(value);

/** 1234.5 → "1.234,50 €" */
export function formatCurrency(value: number | null | undefined, decimals = 2): string {
    return currencyFormatter(decimals).format(isMissing(value) ? 0 : value);
}

/** 1234.5 → "1.235 €" (whole euros) */
export function formatCurrencyRounded(value: number | null | undefined): string {
    return currencyFormatter(0).format(isMissing(value) ? 0 : Math.round(value));
}

/** 1234.567 → "1.234,57" (thousands separator, up to `decimals` decimals) */
export function formatNumber(value: number | null | undefined, decimals = 0): string {
    return isMissing(value) ? EMPTY_VALUE : numberFormatter(decimals).format(value);
}

/** Decimal hours → "h:mm". 1.5 → "1:30", 1.999 → "2:00", -0.5 → "-0:30" */
export function formatHours(hours: number | null | undefined): string {
    if (isMissing(hours)) return EMPTY_VALUE;
    const totalMinutes = Math.round(Math.abs(hours) * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${hours < 0 && totalMinutes > 0 ? '-' : ''}${h}:${String(m).padStart(2, '0')}`;
}

/** Date or ISO string → "06/10/2026" */
export function formatDate(value: Date | string | null | undefined): string {
    if (!value) return EMPTY_VALUE;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return EMPTY_VALUE;
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${date.getFullYear()}`;
}

/** Database datetime (stored wall-clock time, read as UTC) → "06/10/2026, 17:35:00", without a timezone shift */
export function formatDbDateTime(value: Date | string | null | undefined): string {
    const parts = value ? dbDateTimeParts(value) : null;
    if (!parts) return EMPTY_VALUE;
    const [y, m, d] = parts.date.split('-');
    return `${d}/${m}/${y}, ${parts.time}`;
}

/** 1 → "Gennaio" */
export function monthName(month: number): string {
    return APP_COPY.months.long[month - 1] ?? '';
}

/** 1 → "Gen" */
export function monthShortName(month: number): string {
    return APP_COPY.months.short[month - 1] ?? '';
}

/** "2026-10-06" → "06/10" */
export function formatDayMonth(isoDate: string): string {
    const [, month, day] = isoDate.split('-');
    return `${day}/${month}`;
}
