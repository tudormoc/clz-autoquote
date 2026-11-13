'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/** Always unfolded from this screen width up, whatever `open` says (the filters of a report on a computer screen) */
const OPEN_FROM = {
    lg: { box: 'lg:grid-rows-unfolded lg:visible', clip: 'lg:overflow-visible' },
} as const;

interface FoldProps {
    /** What it holds is shown */
    open: boolean;
    /**
     * Keeps what it holds while folded, out of sight: for fields, which must keep what was typed in them. Without it
     * a folded part is not on the page at all, so it costs nothing and starts fresh each time it opens.
     */
    keep?: boolean;
    openFrom?: keyof typeof OPEN_FROM;
    /** Spacing and layout of what unfolds (its padding, margins, edge) */
    className?: string;
    children: React.ReactNode;
}

/** How long an unfolding lasts in the skin that is on (theme.js → SKIN.motion.unfold), in milliseconds; 0 = at once */
function unfoldTime(): number {
    const value = getComputedStyle(document.documentElement).getPropertyValue('--motion-unfold').trim();
    const amount = parseFloat(value);
    if (!Number.isFinite(amount)) return 0;
    return value.endsWith('ms') ? amount : amount * 1000;
}

/**
 * What unfolds in place under its header (the pages of an area, a group of Da fare, a day of Le mie ore, the filters
 * of a report on a phone). The one place where an unfolding is drawn, so a skin animates all of them with one value:
 * the row grows from nothing to its height in `unfold` time, and shrinks back. With no time (today) it opens and
 * closes at once. Rows of a table unfold at once whatever the skin: they cannot be wrapped.
 */
export function Fold({ open, keep = false, openFrom, className, children }: FoldProps) {
    // shown: on the page · spread: at its full height (where the row is heading) · settled: not moving
    const [state, setState] = useState({ shown: open, spread: open, settled: true });
    const firstRun = useRef(true);
    // While it folds it still shows what it held when open (the day being closed, not the one opened in its place)
    const held = useRef(children);
    if (open) held.current = children;

    // Before the browser paints, so with no unfold time nothing is seen half-way
    useLayoutEffect(() => {
        if (firstRun.current) {
            firstRun.current = false;
            return;
        }
        const time = unfoldTime();
        if (time === 0) {
            setState({ shown: open, spread: open, settled: true });
            return;
        }
        let frame = 0;
        if (open) {
            // Drawn folded first, then spread on the next frame: the row needs a height to grow from
            setState({ shown: true, spread: false, settled: false });
            frame = requestAnimationFrame(() => {
                frame = requestAnimationFrame(() => setState({ shown: true, spread: true, settled: false }));
            });
        } else {
            setState((current) => ({ shown: current.shown, spread: false, settled: false }));
        }
        const done = window.setTimeout(() => setState({ shown: open, spread: open, settled: true }), time + 50);
        return () => {
            cancelAnimationFrame(frame);
            window.clearTimeout(done);
        };
    }, [open]);

    const kept = keep || openFrom !== undefined;
    if (!kept && !state.shown) return null;
    // What is kept is always what it holds now: on a wide screen it is in view even when "folded"
    const content = open || kept ? children : held.current;

    return (
        <div
            className={cn(
                'grid transition-rows duration-unfold ease-out',
                state.spread ? 'grid-rows-unfolded' : 'grid-rows-folded',
                // Kept but folded: out of reach of the keyboard and of screen readers
                kept && !state.shown && 'invisible',
                openFrom && OPEN_FROM[openFrom].box
            )}
        >
            {/* Cut off only while it moves or is folded: once open, a focus ring or a shadow may reach past its edge */}
            <div className={cn('min-h-0', !(state.spread && state.settled) && 'overflow-hidden', openFrom && OPEN_FROM[openFrom].clip)}>
                {/* Its own box, so its padding folds away with it */}
                <div className={className}>{content}</div>
            </div>
        </div>
    );
}
