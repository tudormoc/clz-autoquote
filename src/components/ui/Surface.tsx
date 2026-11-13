import type { ClassValue } from 'clsx';
import { cn } from '@/lib/utils';

/**
 * The kinds of surface the screens are made of. A screen says which kind a box is, never how it is drawn: the drawing
 * is here, in one place, for a skin to change (theme.js → SKIN, docs/BACKLOG.md → Skins).
 *   panel     a box of the page: a card, a table, a form, a list
 *   inset     a quiet box set into a panel, a window or the page itself: what a confirm window explains, a preview, a
 *             list inside a form, a lane of the calendar.
 *             With a tone (SURFACE_TONE) it says something: all right, attention, an error
 *   floating  what opens over the page: a menu, a popup, a window
 *   chrome    the frame of the app that stays put: the sidebar
 *   bar       a strip that stays in place while the page scrolls under it: the top bar of a phone, a bar of totals
 *   drawer    a side panel that slides in over the page: the phone menu, the details of a task
 * The last three name their own edge (border-r, border-b …). A use adds spacing and layout, never the background, the
 * corners, the border shade or the shadow of its kind: one value each, here (ESLint refuses a background of its own).
 */
export type SurfaceKind = 'panel' | 'inset' | 'floating' | 'chrome' | 'bar' | 'drawer';

const KINDS: Record<SurfaceKind, string> = {
    panel: 'bg-card border border-border rounded-lg',
    inset: 'bg-background/60 border border-border rounded-lg',
    floating: 'bg-card border border-border-strong rounded-lg shadow-lg animate-enter',
    chrome: 'bg-card border-border',
    bar: 'bg-card/95 border-border backdrop-blur',
    drawer: 'bg-card border-border shadow-xl',
};

export type SurfaceTone = 'info' | 'success' | 'warning' | 'danger';

/** A box that says something (a note, a rule that holds, a warning, an error): its edge and tint, on an inset box */
export const SURFACE_TONE: Record<SurfaceTone, string> = {
    info: 'border-info-500/30 bg-info-500/10',
    success: 'border-success-500/30 bg-success-500/10',
    warning: 'border-warning-500/30 bg-warning-500/10',
    danger: 'border-danger-500/30 bg-danger-500/10',
};

/** A box for what is not there yet (a date still to come, the place a dragged card would land): a dashed edge */
export const SURFACE_PENDING = 'border-dashed';

/** A panel that is the one picked among its like (the open group, the week on screen, today): the accent on its edge, a tint inside */
export const SURFACE_SELECTED = 'border-primary bg-primary/5';

/** The classes of a surface, for an element that is not a plain box (a link, a list, a form, one with a ref) */
export const surfaceClasses = (kind: SurfaceKind, ...classes: ClassValue[]) => cn(KINDS[kind], ...classes);

interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
    kind?: SurfaceKind;
}

/** A box of the given kind (a panel when none is named); `className` adds its spacing and layout */
export function Surface({ kind = 'panel', className, ...props }: SurfaceProps) {
    return <div className={surfaceClasses(kind, className)} {...props} />;
}
