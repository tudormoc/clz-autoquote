import { cn } from '@/lib/utils';
import { EMPTY_VALUE } from '@/lib/format';

const MAX_WIDTH = {
    sm: 'max-w-32',
    md: 'max-w-40',
    lg: 'max-w-48',
    xl: 'max-w-xs',
} as const;

const PRIMARY_TONE = {
    /** Main identifier of the row (commessa, cliente in a client report) */
    code: 'font-mono text-primary',
    /** Secondary identifier (machine, operator, supplier code) */
    muted: 'font-mono text-fg-muted',
    /** Plain text */
    plain: 'font-medium text-fg-strong',
} as const;

interface StackedCellProps {
    primary: React.ReactNode;
    secondary?: React.ReactNode;
    tone?: keyof typeof PRIMARY_TONE;
    /** Truncate both lines at this width; omit to let them wrap freely */
    maxWidth?: keyof typeof MAX_WIDTH;
}

/** Two lines in one cell: a code on top, its name / description below (with full text on hover). */
export function StackedCell({ primary, secondary, tone = 'code', maxWidth }: StackedCellProps) {
    const width = maxWidth && cn('truncate', MAX_WIDTH[maxWidth]);
    return (
        <>
            <div className={cn(PRIMARY_TONE[tone], width)}>{primary ?? EMPTY_VALUE}</div>
            {secondary !== undefined && (
                <div className={cn('text-xs text-fg-subtle', width ?? 'truncate max-w-xs')} title={typeof secondary === 'string' ? secondary : undefined}>
                    {secondary}
                </div>
            )}
        </>
    );
}

/** Faint placeholder for an empty cell */
export function MissingValue() {
    return <span className="text-fg-faint italic">{EMPTY_VALUE}</span>;
}
