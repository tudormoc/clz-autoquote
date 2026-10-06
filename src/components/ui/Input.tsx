import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, id, ...props }, ref) => {
    const isNumberInput = type === 'number';
    
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
        <input
          type={type}
          className={cn(
            "flex h-9 w-full rounded border border-border-strong bg-background px-3 py-2 text-sm text-fg placeholder:text-fg-faint transition-colors focus-visible:outline-none focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50",
            isNumberInput && "font-mono",
            error && "border-danger focus-visible:border-danger",
            className
          )}
          ref={ref}
          id={id}
          {...props}
        />
        {error && (
          <p className="text-xs text-danger mt-1">
            {error}
          </p>
        )}
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }