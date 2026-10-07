import { DatePicker } from '@/components/ui/DatePicker';
import { Field } from '@/components/ui/Field';
import { APP_COPY } from '@/locales';

interface DateRangeFieldsProps {
    dateFrom: string;
    dateTo: string;
    onChange: (range: { dateFrom?: string; dateTo?: string }) => void;
}

/** "Data Da" and "Data A" pickers, as two cells of a filter grid. Dates are "YYYY-MM-DD". */
export function DateRangeFields({ dateFrom, dateTo, onChange }: DateRangeFieldsProps) {
    return (
        <>
            <Field label={APP_COPY.common.dateFrom}>
                <DatePicker value={dateFrom} onChange={(value) => onChange({ dateFrom: value })} />
            </Field>
            <Field label={APP_COPY.common.dateTo}>
                <DatePicker value={dateTo} onChange={(value) => onChange({ dateTo: value })} />
            </Field>
        </>
    );
}
