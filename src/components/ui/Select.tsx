import * as React from "react"
import { cn } from "@/lib/utils"
import { FIELD, FIELD_ERROR } from '@/components/ui/fieldLook';

export interface SelectProps
    extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    error?: string;
    options: { label: string; value: string }[];
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
    ({ className, label, error, id, options, ...props }, ref) => {
        return (
            <div className="w-full">
                {label && (
                    <label
                        htmlFor={id}
                        className="block text-xs font-medium text-fg-muted mb-1.5"
                    >
                        {label}
                    </label>
                )}
                <select
                    className={cn(
                        "flex h-9",
                        FIELD,
                        error && FIELD_ERROR,
                        className
                    )}
                    ref={ref}
                    id={id}
                    {...props}
                >
                    {options.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>
                {error && (
                    <p className="text-xs text-danger mt-1">
                        {error}
                    </p>
                )}
            </div>
        )
    }
)
Select.displayName = "Select"

export { Select }
