import * as React from "react"
import { cn } from "@/lib/utils"
import { FIELD, FIELD_ERROR, FIELD_ERROR_TEXT, FIELD_LABEL } from '@/components/ui/fieldLook';

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
            className={FIELD_LABEL}
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
          <p className={FIELD_ERROR_TEXT}>
            {error}
          </p>
        )}
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }