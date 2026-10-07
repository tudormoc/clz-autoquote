import type { RecordColumn } from '@/components/admin/record-editor/types';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { APP_COPY } from '@/locales';

interface RecordInputProps<T> {
    column: RecordColumn<T>;
    value: string;
    onChange: (value: string) => void;
    autoFocus?: boolean;
}

/** The input for one column, by kind: text, number, percent (with its "%") or a choice. */
export function RecordInput<T>({ column, value, onChange, autoFocus }: RecordInputProps<T>) {
    const { kind } = column;

    if (kind === 'choice') {
        return <Select options={column.options ?? []} value={value} onChange={(e) => onChange(e.target.value)} autoFocus={autoFocus} />;
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
