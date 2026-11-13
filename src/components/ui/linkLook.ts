import type { ClassValue } from 'clsx';
import { cn } from '@/lib/utils';

/**
 * The links read as text, and nothing between them:
 *   accent  a link inside what one reads (an address, a phone number, a procedure to open): the accent, underlined
 *           when the mouse is on it
 *   name    the name of the thing a row is about, which opens it: strong, the accent when the mouse is on it
 *   quiet   a word or a line in the colour of what is around it: the accent when the mouse is on it
 * A link that looks like a button, a row or a box takes that part's classes instead (buttonClasses, menuRowClasses,
 * pressableSurfaceClasses).
 */
export type LinkKind = 'accent' | 'name' | 'quiet';

const KINDS: Record<LinkKind, string> = {
    accent: 'text-primary hover:underline',
    name: 'font-medium text-fg-strong transition-colors hover:text-primary',
    quiet: 'transition-colors hover:text-primary',
};

/** The look of a text link; what follows adds its size and layout: <Link className={linkClasses('name')}> */
export const linkClasses = (kind: LinkKind, ...classes: ClassValue[]) => cn(KINDS[kind], ...classes);
