import { Pressable } from '@/components/ui/Pressable';
import { cn } from '@/lib/utils';

/**
 * A word or a short line one presses, drawn as plain text: quiet, the accent when the mouse is on it ("+ Aggiungi"
 * under a day, "+3" in a full day of the month, the number of a day). `className` adds its size and spacing.
 */
export function TextButton({ className, ...props }: React.ComponentProps<'button'>) {
    return <Pressable type="button" className={cn('inline-flex items-center gap-1 rounded text-fg-subtle transition-colors hover:text-primary disabled:opacity-50', className)} {...props} />;
}
