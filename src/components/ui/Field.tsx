import { cn } from '@/lib/utils';

interface FieldProps {
    label: React.ReactNode;
    /** id of the control, so clicking the label focuses it */
    htmlFor?: string;
    children: React.ReactNode;
    className?: string;
}

/** A form control with its label above (filters, settings forms). */
export function Field({ label, htmlFor, children, className }: FieldProps) {
    return (
        <div className={cn(className)}>
            <label htmlFor={htmlFor} className="block text-xs font-medium text-fg-muted mb-2">
                {label}
            </label>
            {children}
        </div>
    );
}
