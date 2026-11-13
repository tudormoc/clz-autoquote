import * as React from "react"
import { cn } from "@/lib/utils"
import { FIELD, FIELD_ERROR, FIELD_ERROR_TEXT, FIELD_LABEL } from '@/components/ui/fieldLook';

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
                        className={FIELD_LABEL}
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
                    <p className={FIELD_ERROR_TEXT}>
                        {error}
                    </p>
                )}
            </div>
        )
    }
)
Select.displayName = "Select"

export { Select }
