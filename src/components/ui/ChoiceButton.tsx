import { cn } from '@/lib/utils';
import { Pressable } from '@/components/ui/Pressable';

const SIZES = {
    sm: 'py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
} as const;

interface ChoiceButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    selected: boolean;
    size?: keyof typeof SIZES;
}

/** One option of a pick-one or pick-many group (year, month, format …), filled when selected. */
export function ChoiceButton({ selected, size = 'md', className, ...props }: ChoiceButtonProps) {
    return <Pressable type="button" className={choiceClasses({ selected, size, className })} {...props} />;
}

/** The look of an option, also for a link that picks one: <ViewLink className={choiceClasses({ selected })}> */
export function choiceClasses({ selected, size = 'md', className }: { selected: boolean; size?: keyof typeof SIZES; className?: string }) {
    return cn(
        'rounded border font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        SIZES[size],
        selected ? 'bg-primary border-primary text-primary-foreground' : 'bg-muted border-border-strong text-fg-secondary hover:bg-muted-strong',
        className
    );
}
