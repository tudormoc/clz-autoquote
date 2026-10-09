import { LevelCell } from '@/components/admin/access/LevelCell';
import { EMPTY_VALUE } from '@/lib/format';
import type { AccessLevel } from '@/lib/auth/permissions';
import { cn } from '@/lib/utils';
import { APP_COPY } from '@/locales';

const levels = APP_COPY.admin.groups.levels;

/** The three columns, in order, with their names */
export const LEVEL_COLUMNS: { level: AccessLevel | null; label: string }[] = [
    { level: null, label: levels.none },
    { level: 'view', label: levels.view },
    { level: 'edit', label: levels.edit },
];

/** Width of one level column, the same in the header and every row so the ticks line up */
export const LEVEL_COLUMN = 'w-14 sm:w-20 shrink-0 flex justify-center';

const VARIANT = {
    /** "Tutte le pagine" */
    all: 'py-3 bg-primary/5 font-semibold text-fg-strong',
    /** An area (or a single-page area) */
    area: 'py-2.5 bg-muted/40 hover:bg-muted/60 font-semibold text-fg-strong',
    /** A page inside an area */
    page: 'py-2 pl-8 text-fg-secondary hover:bg-muted/30',
} as const;

interface PermissionRowProps {
    label: string;
    variant: keyof typeof VARIANT;
    /** The row's level, or "mixed" when its pages differ */
    level: AccessLevel | null | 'mixed';
    /** Levels some of its pages have (marks the ticks of a mixed row) */
    present?: ReadonlySet<AccessLevel | null>;
    /** "visible / total" after the name of an area */
    count?: string;
    /** Some page of the row changes data, so "Modifica" can be chosen */
    editable: boolean;
    onPick: (level: AccessLevel | null) => void;
}

/** One line of the permission table: name, then a tick under No / Vede / Modifica (a dash where Modifica does not apply). */
export function PermissionRow({ label, variant, level, present, count, editable, onPick }: PermissionRowProps) {
    return (
        <div role="radiogroup" aria-label={label} className={cn('flex items-center gap-2 px-3 text-sm', VARIANT[variant])}>
            <div className="flex-1 min-w-0 flex items-baseline gap-2">
                <span className="truncate max-sm:whitespace-normal">{label}</span>
                {count && <span className="shrink-0 text-xs font-normal font-mono text-fg-muted">{count}</span>}
            </div>
            {LEVEL_COLUMNS.map((column) => (
                <div key={column.label} className={LEVEL_COLUMN}>
                    {column.level === 'edit' && !editable ? (
                        <span className="text-fg-faint">{EMPTY_VALUE}</span>
                    ) : (
                        <LevelCell
                            selected={level === column.level}
                            partial={level === 'mixed' && present?.has(column.level)}
                            label={`${label}: ${column.label}`}
                            onClick={() => onPick(column.level)}
                        />
                    )}
                </div>
            ))}
        </div>
    );
}
