import { CheckCircle2, Circle } from '@/components/ui/icons';
import { IconButton } from '@/components/ui/IconButton';
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
        <IconButton
            type="button"
            tone="success"
            lit={done}
            disabled={disabled}
            onClick={onClick}
            title={label}
            aria-label={label}
            // The circle is the whole button: no room around it, so it sits on the line of its title
            className={cn('shrink-0 rounded-full p-0', className)}
        >
            <Icon size={size === 'sm' ? 16 : 20} />
        </IconButton>
    );
}
