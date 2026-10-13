'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Whether a CSS media query matches now, following changes (window resized, mouse plugged in). On the server, and
 * before the page runs, it answers `serverValue`.
 */
export function useMediaQuery(query: string, serverValue = false): boolean {
    const subscribe = useCallback(
        (onChange: () => void) => {
            const list = window.matchMedia(query);
            list.addEventListener('change', onChange);
            return () => list.removeEventListener('change', onChange);
        },
        [query]
    );
    return useSyncExternalStore(
        subscribe,
        () => window.matchMedia(query).matches,
        () => serverValue
    );
}

/** A mouse or trackpad that can hover (desktop), as opposed to a touch screen only */
export const FINE_POINTER = '(hover: hover) and (pointer: fine)';
