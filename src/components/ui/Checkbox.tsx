import * as React from "react"
import { cn } from "@/lib/utils"

export interface CheckboxProps
    extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
    label?: string;
    error?: string;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
    ({ className, label, error, id, ...props }, ref) => {
        return (
            <div className="flex items-center gap-2">
                <input
                    type="checkbox"
                    className={cn(
                        "h-4 w-4 rounded border-border-strong bg-background text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background transition-colors",
                        className
                    )}
                    ref={ref}
                    id={id}
                    {...props}
                />
                {label && (
                    <label
                        htmlFor={id}
                        className="text-sm font-medium text-fg-secondary leading-none cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-50"
                    >
                        {label}
                    </label>
                )}
                {error && (
                    <p className="text-xs text-danger font-medium ml-2">
                        {error}
                    </p>
                )}
            </div>
        )
    }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
