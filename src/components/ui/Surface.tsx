import type { ClassValue } from 'clsx';
import { cn } from '@/lib/utils';

/**
 * The kinds of surface the screens are made of. A screen says which kind a box is, never how it is drawn: the drawing
 * is here, in one place, for a skin to change (theme.js → SKIN, docs/BACKLOG.md → Skins).
 *   panel     a box of the page: a card, a table, a form, a list
 *   soft      a lighter box inside a page or a window, the page showing through
 *   floating  what opens over the page: a menu, a popup, a window
 *   chrome    the frame of the app: the sidebar, a top or bottom bar, a panel sliding in (it names its own edge: border-r …)
 */
export type SurfaceKind = 'panel' | 'soft' | 'floating' | 'chrome';

const KINDS: Record<SurfaceKind, string> = {
    panel: 'bg-card border border-border rounded-lg',
    soft: 'bg-card/40 border border-border rounded-lg',
    floating: 'bg-card border border-border-strong rounded-lg shadow-lg animate-enter',
    chrome: 'bg-card border-border',
};

/** The classes of a surface, for an element that is not a plain box (a link, a list, a form, one with a ref) */
export const surfaceClasses = (kind: SurfaceKind, ...classes: ClassValue[]) => cn(KINDS[kind], ...classes);

interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
    kind?: SurfaceKind;
}

/** A box of the given kind (a panel when none is named); `className` adds its spacing and layout */
export function Surface({ kind = 'panel', className, ...props }: SurfaceProps) {
    return <div className={surfaceClasses(kind, className)} {...props} />;
}
