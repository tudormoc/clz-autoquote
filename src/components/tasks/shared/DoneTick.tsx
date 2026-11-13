import { CheckCircle2, Circle } from '@/components/ui/icons';
import { Pressable } from '@/components/ui/Pressable';
import { cn } from '@/lib/utils';

interface DoneTickProps {
    done: boolean;
    /** sm on a card of the calendar, md on a row of a list */
    size?: 'sm' | 'md';
    disabled?: boolean;
    /** What a click does ("Segna come fatta", "Riapri"): the tooltip, and the name for screen readers */
    label: string;
    onClick: (event: React.MouseEvent) => void;
    className?: string;
}

/** The circle one clicks to mark a deadline as done: empty and grey while it is open (green under the mouse), a green check once done. */
export function DoneTick({ done, size = 'md', disabled, label, onClick, className }: DoneTickProps) {
    const Icon = done ? CheckCircle2 : Circle;
    return (
        <Pressable
            type="button"
            disabled={disabled}
            onClick={onClick}
            title={label}
            aria-label={label}
            className={cn('shrink-0 rounded-full transition-colors', done ? 'text-success-400' : 'text-fg-muted enabled:hover:text-success-400 disabled:opacity-50', className)}
        >
            <Icon size={size === 'sm' ? 16 : 20} />
        </Pressable>
    );
}
