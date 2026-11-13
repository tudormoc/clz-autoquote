import * as React from 'react';
import { cn } from '@/lib/utils';
import { FIELD } from '@/components/ui/fieldLook';

/** Multi-line text box with the look of Input */
const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
    <textarea
        ref={ref}
        className={cn(
            'flex min-h-20',
            FIELD,
            className
        )}
        {...props}
    />
));
Textarea.displayName = 'Textarea';

export { Textarea };
