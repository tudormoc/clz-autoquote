import type { AccessLevel } from '@/lib/auth/permissions';
import { cn } from '@/lib/utils';
import { APP_COPY } from '@/locales';

const copy = APP_COPY.admin.groups;

type Choice = AccessLevel | null;

const LIT: Record<'none' | 'view' | 'edit', string> = {
    none: 'bg-muted-strong text-fg-strong',
    view: 'bg-primary/15 text-primary',
    edit: 'bg-warning-500/20 text-warning-300',
};

interface LevelSegmentsProps {
    level: AccessLevel | null | 'mixed';
    /** Modifica is offered only where the page (or one of the area's pages) changes data */
    editable: boolean;
    /** "Officina, Preventivi": the cell, for screen readers and tooltips */
    name: string;
    onChange: (level: Choice) => void;
}

/**
 * One cell of the Gruppi table: No | Vede | Modifica side by side, the current one lit. An area whose pages differ
 * ("Misto") lights none; a click still sets all its pages.
 */
export function LevelSegments({ level, editable, name, onChange }: LevelSegmentsProps) {
    const choices: { value: Choice; label: string }[] = [
        { value: null, label: copy.levels.none },
        { value: 'view', label: copy.levels.view },
        ...(editable ? [{ value: 'edit' as const, label: copy.levels.edit }] : []),
    ];
    const mixed = level === 'mixed';
    return (
        <div className="inline-flex flex-col items-center gap-0.5">
            <div
                role="group"
                aria-label={name}
                title={mixed ? copy.mixedHint : undefined}
                className={cn('inline-flex rounded border text-xs', mixed ? 'border-dashed border-border-strong' : 'border-border')}
            >
                {choices.map((choice, index) => {
                    const lit = !mixed && level === choice.value;
                    return (
                        <button
                            key={choice.label}
                            type="button"
                            aria-pressed={lit}
                            title={`${name}: ${choice.label}`}
                            onClick={() => onChange(choice.value)}
                            className={cn(
                                'px-2 py-1 font-medium transition-colors',
                                index > 0 && 'border-l border-border',
                                lit ? LIT[choice.value ?? 'none'] : 'text-fg-muted hover:text-fg hover:bg-muted'
                            )}
                        >
                            {choice.label}
                        </button>
                    );
                })}
            </div>
            {mixed && <span className="text-3xs italic text-fg-muted">{copy.levels.mixed}</span>}
        </div>
    );
}
