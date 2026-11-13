import { FoldArrow } from '@/components/ui/FoldArrow';
import { Pressable } from '@/components/ui/Pressable';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { cn } from '@/lib/utils';

const SIZES = {
    sm: { row: 'gap-1', arrow: 14 },
    md: { row: 'gap-2', arrow: 16 },
} as const;

interface FoldToggleProps extends React.ComponentProps<'button'> {
    /** What it folds is shown */
    open: boolean;
    size?: keyof typeof SIZES;
    /** How many things it folds, shown after its name */
    count?: number;
}

/**
 * The header one presses to unfold what is under it and to fold it again: the arrow that turns, its name, a count.
 * The one look of every such header (a group of Da fare, an area of Gruppi, a group of a settings table).
 */
export function FoldToggle({ open, size = 'md', count, className, children, ...props }: FoldToggleProps) {
    return (
        <Pressable
            type="button"
            aria-expanded={open}
            className={cn('inline-flex items-center rounded px-1 text-left transition-colors hover:bg-muted', SIZES[size].row, className)}
            {...props}
        >
            <FoldArrow open={open} size={SIZES[size].arrow} className="opacity-60" />
            {children}
            {count !== undefined && (
                <StatusBadge tone="neutral" mono>
                    {count}
                </StatusBadge>
            )}
        </Pressable>
    );
}
