import { Pressable } from '@/components/ui/Pressable';
import { cn } from '@/lib/utils';

const SIZES = {
    xs: 'p-0.5',
    sm: 'p-1',
    md: 'p-1.5',
    lg: 'p-2',
} as const;

/**
 * What the mouse on it lights up: plain, red for a button that removes something, green for one that marks something
 * as done; amber from the start for one that writes to the programs
 */
const TONES = {
    default: 'hover:text-fg-strong hover:bg-muted',
    danger: 'hover:text-danger hover:bg-danger/10',
    warning: 'text-warning-400 hover:text-warning-300 hover:bg-warning-500/10',
    success: 'enabled:hover:text-success-400 enabled:hover:bg-success-500/10',
} as const;

/** Lit without the mouse: what the button marks is so already (a deadline that is done). It keeps its colour when it cannot be pressed. */
const LIT: Record<keyof typeof TONES, string> = {
    default: 'text-fg-strong disabled:opacity-100',
    danger: 'text-danger disabled:opacity-100',
    warning: 'text-warning-300 disabled:opacity-100',
    success: 'text-success-400 disabled:opacity-100',
};

interface IconButtonLook {
    size?: keyof typeof SIZES;
    tone?: keyof typeof TONES;
    /** Shows its lit colour all the time, not only under the mouse */
    lit?: boolean;
    className?: string;
}

/** The look of an icon button, also for a link that is only an icon: <a className={iconButtonClasses()} title="…"> */
export function iconButtonClasses({ size = 'md', tone = 'default', lit = false, className }: IconButtonLook = {}) {
    return cn('rounded text-fg-muted transition-colors disabled:opacity-50', TONES[tone], lit && LIT[tone], SIZES[size], className);
}

interface IconButtonProps extends React.ComponentProps<'button'>, Omit<IconButtonLook, 'className'> {}

/** A button that is only an icon (close, edit, delete, the "⋯" of a row, the tick of a deadline): grey, lit when the mouse is on it. Name it with `aria-label` or `title`. */
export function IconButton({ size, tone, lit, className, ...props }: IconButtonProps) {
    return <Pressable className={iconButtonClasses({ size, tone, lit, className })} {...props} />;
}
