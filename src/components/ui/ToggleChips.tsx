import { ChoiceButton, type ChoiceTone } from '@/components/ui/ChoiceButton';
import { Field } from '@/components/ui/Field';

export interface ChipOption<K> {
    key: K;
    label: React.ReactNode;
    /** Shown as "(12)" after the label; omit before the data is loaded */
    count?: number | null;
    tone?: ChoiceTone;
}

interface ToggleChipsProps<K> {
    label: React.ReactNode;
    options: ChipOption<K>[];
    active: ReadonlySet<K>;
    onToggle: (key: K) => void;
}

/** A labelled row of on/off chips that show or hide groups of rows (stato, categoria …). */
export function ToggleChips<K>({ label, options, active, onToggle }: ToggleChipsProps<K>) {
    return (
        <Field label={label}>
            <div className="flex flex-wrap gap-2">
                {options.map((option) => (
                    <ChoiceButton key={String(option.key)} size="sm" tone={option.tone} selected={active.has(option.key)} onClick={() => onToggle(option.key)}>
                        {option.label}
                        {option.count !== undefined && option.count !== null && <span className="ml-1.5 opacity-70">({option.count})</span>}
                    </ChoiceButton>
                ))}
            </div>
        </Field>
    );
}
