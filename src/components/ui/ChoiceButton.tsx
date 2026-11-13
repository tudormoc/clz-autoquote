import { Pressable } from '@/components/ui/Pressable';
import { cn } from '@/lib/utils';

/** What an option that is on says besides "on": the app's accent, attention, all right */
export type ChoiceTone = 'primary' | 'warning' | 'success';

/**
 * An option that is on, by tone, and one that is off. The one look of everything that is on or off: a pick-one button
 * (year, month, kind), a filter chip (ToggleChips), a view switch, a light of the Gruppi page.
 */
export const CHOICE_ON: Record<ChoiceTone, string> = {
    primary: 'bg-primary/10 border-primary/40 text-primary',
    warning: 'bg-warning-500/15 border-warning-500/50 text-warning-300',
    success: 'bg-success-500/10 border-success-500/40 text-success-300',
};
export const CHOICE_OFF = 'bg-transparent border-border-strong text-fg-secondary hover:border-fg-subtle hover:text-fg';

const SIZES = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
} as const;

interface ChoiceLook {
    selected: boolean;
    tone?: ChoiceTone;
    size?: keyof typeof SIZES;
    className?: string;
}

/** The look of an option, also for a link that picks one: <ViewLink className={choiceClasses({ selected })}> */
export function choiceClasses({ selected, tone = 'primary', size = 'md', className }: ChoiceLook) {
    return cn(
        'rounded border font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        SIZES[size],
        selected ? CHOICE_ON[tone] : CHOICE_OFF,
        className
    );
}

interface ChoiceButtonProps extends React.ComponentProps<'button'>, Omit<ChoiceLook, 'className'> {}

/** One option of a group one picks from or switches on and off (a year, a filter, a view): tinted while it is on. */
export function ChoiceButton({ selected, tone, size, className, ...props }: ChoiceButtonProps) {
    return <Pressable type="button" aria-pressed={selected} className={choiceClasses({ selected, tone, size, className })} {...props} />;
}
