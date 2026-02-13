import * as React from "react"
import { cn } from "@/lib/utils"

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
                        className="block text-xs font-medium text-zinc-400 mb-1.5"
                    >
                        {label}
                    </label>
                )}
                <select
                    className={cn(
                        "flex h-9 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 transition-colors focus-visible:outline-none focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50",
                        error && "border-destructive focus-visible:border-destructive",
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
                    <p className="text-xs text-destructive mt-1">
                        {error}
                    </p>
                )}
            </div>
        )
    }
)
Select.displayName = "Select"

export { Select }
