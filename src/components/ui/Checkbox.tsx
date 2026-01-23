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
            <div className="flex items-center space-x-2">
                <input
                    type="checkbox"
                    className={cn(
                        "h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary",
                        className
                    )}
                    ref={ref}
                    id={id}
                    {...props}
                />
                {label && (
                    <label
                        htmlFor={id}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                        {label}
                    </label>
                )}
                {error && (
                    <p className="text-sm text-destructive font-medium animate-in fade-in slide-in-from-top-1 ml-2">
                        {error}
                    </p>
                )}
            </div>
        )
    }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
