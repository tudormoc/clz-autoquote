import { ChevronDown } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

interface FoldArrowProps {
    /** What it folds is shown */
    open: boolean;
    size?: number;
    className?: string;
}

/** The arrow of everything that unfolds in place: it points right while folded and turns down when open. */
export function FoldArrow({ open, size = 16, className }: FoldArrowProps) {
    return <ChevronDown size={size} aria-hidden className={cn('shrink-0 transition-transform', !open && '-rotate-90', className)} />;
}
