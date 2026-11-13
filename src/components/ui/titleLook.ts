import type { ClassValue } from 'clsx';
import { cn } from '@/lib/utils';

/**
 * The four titles of the app, and nothing between them:
 *   page     the name of the page or of what is open on it (an order, a table)
 *   panel    the title of a panel, a card, a window
 *   section  a part inside a panel or a form
 *   label    a small title over a few lines or a group of fields
 * A heading keeps its own tag (h1 … h4) and takes its look from here: its size, weight and colour are never written in
 * a screen, so a skin that gives titles their own font does it in this one place.
 */
export type TitleLevel = 'page' | 'panel' | 'section' | 'label';

const TITLES: Record<TitleLevel, string> = {
    page: 'text-xl font-bold text-fg-strong',
    panel: 'text-base font-semibold text-fg-strong',
    section: 'text-sm font-semibold text-fg-soft',
    label: 'text-xs font-semibold text-fg-muted',
};

/** The look of a title; what follows adds its layout (a margin, an icon beside it) or a tone: <h3 className={titleClasses('section', 'mb-2')}> */
export const titleClasses = (level: TitleLevel, ...classes: ClassValue[]) => cn(TITLES[level], ...classes);
