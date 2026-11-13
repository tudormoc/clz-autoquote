import type { ClassValue } from 'clsx';
import { Pressable } from '@/components/ui/Pressable';
import { SURFACE_SELECTED, SURFACE_TONE, surfaceClasses, type SurfaceTone } from '@/components/ui/Surface';

interface PressableSurfaceLook {
    /** panel: a box of the page; inset: a quiet one inside a panel (a date still to come) */
    kind?: 'panel' | 'inset';
    /** What the box says (a deadline that is late): its edge and tint */
    tone?: SurfaceTone;
    /** The one picked among its like (the week on screen, the open entry) */
    selected?: boolean;
    /** Drawn without its box until the mouse is on it or it is picked (an entry that is done) */
    bare?: boolean;
}

/** The look of a box one presses, also for a link or a card that is one: lit under the mouse, or marked as the one picked */
export function pressableSurfaceClasses({ kind = 'panel', tone, selected = false, bare = false }: PressableSurfaceLook, ...classes: ClassValue[]) {
    return surfaceClasses(
        kind,
        tone && SURFACE_TONE[tone],
        'text-left cursor-pointer transition-colors',
        selected ? SURFACE_SELECTED : 'hover:bg-muted',
        bare && !selected && 'border-transparent bg-transparent',
        ...classes
    );
}

interface SurfaceButtonProps extends React.ComponentProps<'button'>, PressableSurfaceLook {}

/** A box one presses: a tile to pick (a column, a week), an entry of the calendar that opens. `className` adds its spacing and layout. */
export function SurfaceButton({ kind, tone, selected, bare, className, ...props }: SurfaceButtonProps) {
    return <Pressable type="button" className={pressableSurfaceClasses({ kind, tone, selected, bare }, className)} {...props} />;
}
