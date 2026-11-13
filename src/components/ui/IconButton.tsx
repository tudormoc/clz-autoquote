import { Pressable } from '@/components/ui/Pressable';
import { cn } from '@/lib/utils';

const SIZES = {
    xs: 'p-0.5',
    sm: 'p-1',
    md: 'p-1.5',
    lg: 'p-2',
} as const;

/** What the mouse on it lights up: plain, red for a button that removes something; amber from the start for one that writes to the programs */
const TONES = {
    default: 'hover:text-fg-strong hover:bg-muted',
    danger: 'hover:text-danger hover:bg-danger/10',
    warning: 'text-warning-400 hover:text-warning-300 hover:bg-warning-500/10',
} as const;

interface IconButtonLook {
    size?: keyof typeof SIZES;
    tone?: keyof typeof TONES;
    className?: string;
}

/** The look of an icon button, also for a link that is only an icon: <a className={iconButtonClasses()} title="…"> */
export function iconButtonClasses({ size = 'md', tone = 'default', className }: IconButtonLook = {}) {
    return cn('rounded text-fg-muted transition-colors disabled:opacity-50', TONES[tone], SIZES[size], className);
}

interface IconButtonProps extends React.ComponentProps<'button'>, Omit<IconButtonLook, 'className'> {}

/** A button that is only an icon (close, edit, delete, the "⋯" of a row): grey, lit when the mouse is on it. Name it with `aria-label` or `title`. */
export function IconButton({ size, tone, className, ...props }: IconButtonProps) {
    return <Pressable className={iconButtonClasses({ size, tone, className })} {...props} />;
}
