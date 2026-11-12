import * as React from "react"
import { cn } from "@/lib/utils"
import { Pressable } from '@/components/ui/Pressable';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'warning';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  secondary: "bg-muted text-fg hover:bg-muted-strong border border-border-strong",
  outline: "border border-border-strong bg-transparent hover:bg-muted text-fg",
  ghost: "hover:bg-muted text-fg",
  /** Confirms a deletion */
  danger: "bg-danger-600 text-fg-strong hover:bg-danger-500",
  /** Writes to the production databases (realign an order) */
  warning: "bg-warning-500 text-fg-inverse hover:bg-warning-400"
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-4 text-sm",
  lg: "h-10 px-6 text-sm"
};

/** Button classes, also for links that should look like buttons: <Link className={buttonClasses({ variant: 'outline' })}> */
export function buttonClasses({ variant = 'primary', size = 'md', className }: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50",
    VARIANTS[variant],
    SIZES[size],
    className
  );
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <Pressable className={buttonClasses({ variant, size, className })} ref={ref} {...props} />
  )
)
Button.displayName = "Button"

export { Button }
