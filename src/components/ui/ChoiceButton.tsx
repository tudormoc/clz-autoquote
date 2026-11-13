import { Pressable } from '@/components/ui/Pressable';
import { cn } from '@/lib/utils';

/** What an option that is on says besides "on": the app's accent, attention, all right */
export type ChoiceTone = 'primary' | 'warning' | 'success';

/**
 * An option that is on, by tone, and one that is off. The one look of everything that is on or off: a pick-one button
 * (year, month, kind), a filter chip (ToggleChips), a view switch, a light of the Gruppi page.
 */
const CHOICE_ON: Record<ChoiceTone, string> = {
    primary: 'bg-primary/10 border-primary/40 text-primary',
    warning: 'bg-warning-500/15 border-warning-500/50 text-warning-300',
    success: 'bg-success-500/10 border-success-500/40 text-success-300',
};
const CHOICE_OFF = 'bg-transparent border-border-strong text-fg-secondary hover:border-fg-subtle hover:text-fg';
/** On for some of what it stands for (a light over several pages): off, with a dashed edge */
const CHOICE_MIXED = 'border-dashed';

const SIZES = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    /** Only an icon inside (a round light) */
    icon: 'size-8 inline-flex items-center justify-center',
} as const;

interface ChoiceLook {
    /** 'mixed': it stands for several things and only some of them are on */
    selected: boolean | 'mixed';
    tone?: ChoiceTone;
    size?: keyof typeof SIZES;
    /** A pill or a round light instead of a box */
    round?: boolean;
    className?: string;
}

/** The look of an option, also for a link that picks one: <ViewLink className={choiceClasses({ selected })}> */
export function choiceClasses({ selected, tone = 'primary', size = 'md', round = false, className }: ChoiceLook) {
    return cn(
        'border font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        round ? 'rounded-full' : 'rounded',
        SIZES[size],
        selected === true ? CHOICE_ON[tone] : CHOICE_OFF,
        selected === 'mixed' && CHOICE_MIXED,
        className
    );
}

interface ChoiceButtonProps extends React.ComponentProps<'button'>, Omit<ChoiceLook, 'className'> {}

/** One option of a group one picks from or switches on and off (a year, a filter, a view, a light): tinted while it is on. */
export function ChoiceButton({ selected, tone, size, round, className, ...props }: ChoiceButtonProps) {
    return <Pressable type="button" aria-pressed={selected} className={choiceClasses({ selected, tone, size, round, className })} {...props} />;
}
