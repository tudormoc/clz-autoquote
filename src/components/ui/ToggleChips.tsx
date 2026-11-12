import { Field } from '@/components/ui/Field';
import { cn } from '@/lib/utils';
import { Pressable } from '@/components/ui/Pressable';

export type ChipTone = 'primary' | 'warning' | 'success';

/** A chip that is on, by tone, and one that is off: also the look of the lights of the Gruppi page */
export const CHIP_ACTIVE: Record<ChipTone, string> = {
    primary: 'bg-primary/10 border-primary/40 text-primary',
    warning: 'bg-warning-500/15 border-warning-500/50 text-warning-300',
    success: 'bg-success-500/10 border-success-500/40 text-success-300',
};
export const CHIP_INACTIVE = 'bg-transparent border-border-strong text-fg-subtle hover:border-fg-subtle hover:text-fg-secondary';

export interface ChipOption<K> {
    key: K;
    label: React.ReactNode;
    /** Shown as "(12)" after the label; omit before the data is loaded */
    count?: number | null;
    tone?: ChipTone;
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
                    <Pressable
                        key={String(option.key)}
                        type="button"
                        onClick={() => onToggle(option.key)}
                        className={cn(
                            'px-3 py-1 rounded text-xs font-medium transition-colors border',
                            active.has(option.key) ? CHIP_ACTIVE[option.tone ?? 'primary'] : CHIP_INACTIVE
                        )}
                    >
                        {option.label}
                        {option.count !== undefined && option.count !== null && (
                            <span className="ml-1.5 opacity-70">({option.count})</span>
                        )}
                    </Pressable>
                ))}
            </div>
        </Field>
    );
}
