import { cn } from '@/lib/utils';

/**
 * The button under everything one presses: Button, IconButton, a chip, a tab, a row that opens something. It draws
 * nothing itself (the caller's classes do), but it is the one `<button>` of the app, so a skin has one place to give
 * every press its feel: while pressed it shrinks by the skin's `press` (theme.js → SKIN.motion; 1 = not at all).
 * ESLint refuses a `<button>` written anywhere else.
 */
export function Pressable({ className, ...props }: React.ComponentProps<'button'>) {
    // eslint-disable-next-line no-restricted-syntax -- the one <button> of the app
    return <button className={cn('enabled:active:[scale:var(--motion-press)]', className)} {...props} />;
}
