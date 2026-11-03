import { Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { monthName } from '@/lib/format';
import { APP_COPY } from '@/locales';

interface MonthFieldProps {
    value: number;
    onChange: (month: number) => void;
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

/** "Mese" as a cell of a filter grid: January to December, by name (1–12). */
export function MonthField({ value, onChange }: MonthFieldProps) {
    const options = MONTHS.map((month) => ({ value: String(month), label: monthName(month) }));
    return (
        <Field label={APP_COPY.common.month}>
            <Select value={String(value)} options={options} aria-label={APP_COPY.common.month} onChange={(e) => onChange(Number(e.target.value))} />
        </Field>
    );
}
