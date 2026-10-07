import type { TableFilter } from '@/app/db-actions';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { APP_COPY } from '@/locales';

const copy = APP_COPY.database;

const FIELDS: { key: keyof TableFilter; placeholder: string; width: string }[] = [
    { key: 'column', placeholder: copy.column, width: 'w-32' },
    { key: 'value', placeholder: copy.value, width: 'w-28' },
    { key: 'search', placeholder: copy.search, width: 'w-52' },
];

interface TableFilterFormProps {
    filter: TableFilter;
    onChange: (filter: TableFilter) => void;
    onApply: () => void;
}

/** Column = value filter plus a search in all text columns. */
export function TableFilterForm({ filter, onChange, onApply }: TableFilterFormProps) {
    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                onApply();
            }}
            className="flex flex-wrap items-center gap-2"
        >
            {FIELDS.map(({ key, placeholder, width }) => (
                <div key={key} className={width}>
                    <Input placeholder={placeholder} value={filter[key]} onChange={(e) => onChange({ ...filter, [key]: e.target.value })} />
                </div>
            ))}
            <Button type="submit" size="sm">{copy.apply}</Button>
        </form>
    );
}
