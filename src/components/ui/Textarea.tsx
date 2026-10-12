import * as React from 'react';
import { cn } from '@/lib/utils';

/** Multi-line text box with the look of Input */
const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
    <textarea
        ref={ref}
        className={cn(
            'flex w-full min-h-20 rounded border border-border-strong bg-background px-3 py-2 text-sm text-fg placeholder:text-fg-faint transition-colors focus-visible:outline-none focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50',
            className
        )}
        {...props}
    />
));
Textarea.displayName = 'Textarea';

export { Textarea };
