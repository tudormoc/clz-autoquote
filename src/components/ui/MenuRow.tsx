import type { ClassValue } from 'clsx';
import { Pressable } from '@/components/ui/Pressable';
import { cn } from '@/lib/utils';

/** A row that is the one picked among its like (the open table, the page one is on): the accent, on a tint of it */
const ROW_PICKED = 'bg-primary/10 text-primary font-medium';

/**
 * The look of a row one presses, also for a link or a label that is one: lit when the mouse is on it, the accent
 * when it is the one picked. <ViewLink className={menuRowClasses({ selected })}>
 */
export function menuRowClasses({ selected = false, quiet = false }: MenuRowLook = {}, ...classes: ClassValue[]) {
    return cn(
        'w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left cursor-pointer transition-colors disabled:pointer-events-none',
        selected ? ROW_PICKED : 'hover:bg-muted',
        quiet && !selected && 'text-fg-muted hover:text-fg',
        ...classes
    );
}

interface MenuRowLook {
    /** The one picked among its like */
    selected?: boolean;
    /** Grey until the mouse is on it or it is picked (a row of the sidebar, a table of a long list) */
    quiet?: boolean;
}

interface MenuRowProps extends React.ComponentProps<'button'>, MenuRowLook {}

/**
 * A row one presses: an action of a menu, a name in a list one picks from (the clients found while typing), a day
 * that opens in place, a row of the sidebar. Lit when the mouse is on it; one that cannot be pressed stays still.
 */
export function MenuRow({ selected, quiet, className, ...props }: MenuRowProps) {
    return <Pressable type="button" className={menuRowClasses({ selected, quiet }, className)} {...props} />;
}
