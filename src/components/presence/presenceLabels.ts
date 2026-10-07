import { APP_COPY } from '@/locales';

type HoursField = keyof typeof APP_COPY.analytics.monthlySummary.fields;

/** Italian name of an hours field ("ore_ferie" → "Ferie"), for badges and the prefill summary */
export function presenceFieldLabel(field: HoursField): string {
    return APP_COPY.analytics.monthlySummary.fields[field] ?? field;
}
