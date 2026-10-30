import { Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { APP_CONFIG } from '@/config/constants';
import { recentYears } from '@/lib/dateUtils';
import { APP_COPY } from '@/locales';

interface YearFieldProps {
    value: number;
    onChange: (year: number) => void;
}

/** "Anno" as a cell of a filter grid: this year and the few before it (APP_CONFIG.UI.YEARS_IN_FILTERS). */
export function YearField({ value, onChange }: YearFieldProps) {
    const options = recentYears(APP_CONFIG.UI.YEARS_IN_FILTERS).map((year) => ({ value: String(year), label: String(year) }));
    return (
        <Field label={APP_COPY.common.year}>
            <Select value={String(value)} options={options} aria-label={APP_COPY.common.year} onChange={(e) => onChange(Number(e.target.value))} />
        </Field>
    );
}
