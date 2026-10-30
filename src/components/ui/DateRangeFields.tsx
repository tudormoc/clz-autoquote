import { DatePicker } from '@/components/ui/DatePicker';
import { Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { DATE_PERIODS, periodOf, periodRange, type DatePeriod, type DateRange } from '@/lib/dateUtils';
import { APP_COPY } from '@/locales';

interface DateRangeFieldsProps {
    dateFrom: string;
    dateTo: string;
    onChange: (range: Partial<DateRange>) => void;
}

const copy = APP_COPY.common;
const CUSTOM = '';
const PERIOD_OPTIONS = [...DATE_PERIODS.map((period) => ({ value: period, label: copy.periods[period] })), { value: CUSTOM, label: copy.periods.custom }];

/**
 * "Periodo", "Data Da" and "Data A" as three cells of a filter grid: a ready-made period fills both dates (the current
 * month or year run up to today); a date typed by hand shows the period as "Personalizzato". Dates are "YYYY-MM-DD".
 */
export function DateRangeFields({ dateFrom, dateTo, onChange }: DateRangeFieldsProps) {
    const period = periodOf({ dateFrom, dateTo }) ?? CUSTOM;
    return (
        <>
            <Field label={copy.period}>
                <Select
                    value={period}
                    options={PERIOD_OPTIONS}
                    aria-label={copy.period}
                    onChange={(e) => {
                        const chosen = e.target.value as DatePeriod | typeof CUSTOM;
                        if (chosen !== CUSTOM) onChange(periodRange(chosen));
                    }}
                />
            </Field>
            <Field label={copy.dateFrom}>
                <DatePicker value={dateFrom} onChange={(value) => onChange({ dateFrom: value })} />
            </Field>
            <Field label={copy.dateTo}>
                <DatePicker value={dateTo} onChange={(value) => onChange({ dateTo: value })} />
            </Field>
        </>
    );
}
