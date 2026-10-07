import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { APP_COPY } from '@/locales';

interface SearchFieldProps {
    label: React.ReactNode;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

/** Labelled text box for a "contains" filter (commessa, cliente, macchina …). */
export function SearchField({ label, value, onChange, placeholder = APP_COPY.common.search }: SearchFieldProps) {
    return (
        <Field label={label}>
            <Input type="text" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
        </Field>
    );
}
