import { cn } from '@/lib/utils';

/**
 * One row of the sidebar (an area, the fold button): taller on phones for the finger,
 * only the icon, centred, while the sidebar is folded.
 */
export const SIDEBAR_ROW =
    'flex items-center gap-3 h-10 lg:h-9 px-3 rounded-md text-sm font-medium whitespace-nowrap overflow-hidden collapsed:justify-center collapsed:px-0';

/** A row that does something instead of opening a page (Cambia PIN, Esci, fold the sidebar): what it adds to a MenuRow */
export const SIDEBAR_ACTION_ROW = cn(SIDEBAR_ROW, 'text-fg-muted hover:text-fg');
