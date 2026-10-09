import { cn } from '@/lib/utils';

interface SwitchProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    /** What it switches, for screen readers and as tooltip ("Sospendi Mario") */
    label: string;
    disabled?: boolean;
}

/** On / off switch, green when on (e.g. a user who may log in). */
export function Switch({ checked, onChange, label, disabled }: SwitchProps) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            title={label}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={cn(
                'inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors disabled:opacity-50',
                checked ? 'bg-success-500' : 'bg-muted-strong'
            )}
        >
            <span className={cn('size-4 rounded-full bg-fg-strong transition-transform', checked && 'translate-x-4')} />
        </button>
    );
}
