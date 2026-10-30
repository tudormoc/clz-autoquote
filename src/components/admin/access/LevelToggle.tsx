import type { AccessLevel } from '@/lib/auth/permissions';
import { cn } from '@/lib/utils';
import { APP_COPY } from '@/locales';

const levels = APP_COPY.admin.groups.levels;
const functionLevels = APP_COPY.admin.groups.functionLevels;

type Shown = AccessLevel | null | 'mixed';

const LOOK: Record<'none' | 'view' | 'edit' | 'mixed', string> = {
    none: 'border-dashed border-border-strong text-fg-faint hover:text-fg-secondary hover:border-fg-subtle',
    view: 'bg-primary/10 border-primary/40 text-primary hover:bg-primary/20',
    edit: 'bg-warning-500/15 border-warning-500/50 text-warning-300 hover:bg-warning-500/25',
    mixed: 'border-border-strong text-fg-muted italic hover:text-fg-secondary',
};

interface LevelToggleProps {
    level: Shown;
    /** A page: No / Vede / Modifica / Misto. A function: No / Sì. */
    variant?: 'page' | 'function';
    /** For screen readers and as tooltip: "Officina, Preventivi: Vede" */
    label: (level: string) => string;
    onClick: () => void;
}

/** One box of the Gruppi table: No / Vede / Modifica (or Misto for an area whose pages differ); a click moves it on. */
export function LevelToggle({ level, variant = 'page', label, onClick }: LevelToggleProps) {
    const key = level ?? 'none';
    const text = variant === 'function' ? functionLevels[key === 'edit' ? 'edit' : 'none'] : levels[key];
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label(text)}
            title={label(text)}
            className={cn('w-20 px-2 py-1 rounded border text-xs font-medium transition-colors', LOOK[key])}
        >
            {text}
        </button>
    );
}
