import * as React from "react"
import { cn } from "@/lib/utils"
import { FIELD, FIELD_ERROR } from '@/components/ui/fieldLook';

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
            "flex h-9",
            FIELD,
            isNumberInput && "font-mono",
            error && FIELD_ERROR,
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