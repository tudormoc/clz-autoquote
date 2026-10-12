import type { RecordColumn } from '@/components/admin/record-editor/types';
import { DatePicker } from '@/components/ui/DatePicker';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { APP_COPY } from '@/locales';

interface RecordInputProps<T> {
    column: RecordColumn<T>;
    value: string;
    onChange: (value: string) => void;
    autoFocus?: boolean;
}

/** Options of a yes / no value */
const FLAG_OPTIONS = [
    { value: '1', label: APP_COPY.common.yes },
    { value: '0', label: APP_COPY.common.no },
];

/** The input for one column, by kind: text, number, percent (with its "%"), a choice, a date or yes / no. */
export function RecordInput<T>({ column, value, onChange, autoFocus }: RecordInputProps<T>) {
    const { kind } = column;

    if (kind === 'choice' || kind === 'flag') {
        const options = kind === 'flag' ? FLAG_OPTIONS : column.options ?? [];
        return <Select options={options} value={value} onChange={(e) => onChange(e.target.value)} autoFocus={autoFocus} />;
    }
    if (kind === 'date') {
        return <DatePicker value={value} onChange={onChange} autoFocus={autoFocus} />;
    }

    const isText = kind === 'text';
    const input = (
        <Input
            type={isText ? 'text' : 'number'}
            step={column.step ?? (kind === 'decimal' || kind === 'percent' ? 'any' : '1')}
            min={isText ? undefined : 0}
            max={column.max}
            placeholder={column.placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            autoFocus={autoFocus}
        />
    );

    return kind === 'percent' ? (
        <div className="flex items-center gap-1">
            {input}
            <span className="text-xs text-fg-muted">{APP_COPY.admin.records.percentSuffix}</span>
        </div>
    ) : (
        input
    );
}
