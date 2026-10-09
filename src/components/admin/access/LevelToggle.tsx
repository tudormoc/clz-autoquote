import type { AccessLevel } from '@/lib/auth/permissions';
import { cn } from '@/lib/utils';
import { APP_COPY } from '@/locales';

const levels = APP_COPY.admin.groups.levels;

type Shown = AccessLevel | null | 'mixed';

const LOOK: Record<'none' | 'view' | 'edit' | 'mixed', { label: string; className: string }> = {
    none: { label: levels.none, className: 'border-dashed border-border-strong text-fg-faint hover:text-fg-secondary hover:border-fg-subtle' },
    view: { label: levels.view, className: 'bg-primary/10 border-primary/40 text-primary hover:bg-primary/20' },
    edit: { label: levels.edit, className: 'bg-warning-500/15 border-warning-500/50 text-warning-300 hover:bg-warning-500/25' },
    mixed: { label: levels.mixed, className: 'border-border-strong text-fg-muted italic hover:text-fg-secondary' },
};

interface LevelToggleProps {
    level: Shown;
    /** For screen readers and as tooltip: "Officina, Preventivi: Vede" */
    label: (level: string) => string;
    onClick: () => void;
}

/** One box of the Gruppi table: No / Vede / Modifica (or Misto for an area whose pages differ); a click moves it on. */
export function LevelToggle({ level, label, onClick }: LevelToggleProps) {
    const look = LOOK[level ?? 'none'];
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label(look.label)}
            title={label(look.label)}
            className={cn('w-20 px-2 py-1 rounded border text-xs font-medium transition-colors', look.className)}
        >
            {look.label}
        </button>
    );
}
