import { Pressable } from '@/components/ui/Pressable';
import { cn } from '@/lib/utils';

const SIZES = {
    sm: 'p-1',
    md: 'p-1.5',
    lg: 'p-2',
} as const;

interface IconButtonProps extends React.ComponentProps<'button'> {
    size?: keyof typeof SIZES;
}

/** A button that is only an icon (close, edit, the "⋯" of a row): grey, lit when the mouse is on it. Name it with `aria-label` or `title`. */
export function IconButton({ size = 'md', className, ...props }: IconButtonProps) {
    return <Pressable className={cn('rounded text-fg-muted hover:text-fg-strong hover:bg-muted transition-colors', SIZES[size], className)} {...props} />;
}
