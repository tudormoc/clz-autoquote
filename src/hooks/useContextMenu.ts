'use client';

import { useCallback, useRef, useState } from 'react';
import { APP_CONFIG } from '@/config/constants';

type Point = { x: number; y: number };

/**
 * A right-click menu: `open` goes on the element's onContextMenu, `touchProps` on the element for phones (holding a
 * finger on it opens the same menu), `at` is where to draw the `FloatingMenu` (null = closed). Opened from the
 * keyboard (menu key, Shift+F10) it sits under the element.
 */
export function useContextMenu() {
    const [at, setAt] = useState<Point | null>(null);
    const timer = useRef<number | null>(null);
    const start = useRef<Point | null>(null);
    const held = useRef(false);

    const open = useCallback((event: React.MouseEvent<HTMLElement>) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.clientX === 0 && event.clientY === 0) {
            const box = event.currentTarget.getBoundingClientRect();
            setAt({ x: box.left, y: box.bottom });
        } else setAt({ x: event.clientX, y: event.clientY });
    }, []);
    const close = useCallback(() => setAt(null), []);

    const cancel = () => {
        if (timer.current !== null) window.clearTimeout(timer.current);
        timer.current = null;
    };
    const touchProps: React.HTMLAttributes<HTMLElement> = {
        onTouchStart: (event) => {
            cancel();
            held.current = false;
            if (event.touches.length !== 1) return;
            const touch = event.touches[0];
            const point = { x: touch.clientX, y: touch.clientY };
            start.current = point;
            timer.current = window.setTimeout(() => {
                held.current = true;
                setAt(point);
            }, APP_CONFIG.UI.LONG_PRESS_MS);
        },
        onTouchMove: (event) => {
            const touch = event.touches[0];
            if (start.current && touch && Math.hypot(touch.clientX - start.current.x, touch.clientY - start.current.y) > APP_CONFIG.UI.TOUCH_SLOP_PX) cancel();
        },
        // After a hold the finger lifting must not also "click" (that would open the card)
        onTouchEnd: (event) => {
            cancel();
            if (held.current) event.preventDefault();
        },
        onTouchCancel: cancel,
    };

    return { at, open, close, touchProps };
}
