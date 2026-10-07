'use client';

import { useSyncExternalStore } from 'react';

/** A tiny value store that any code can update and any component can watch (notices, the confirm window). */
export interface Store<T> {
    get: () => T;
    set: (value: T) => void;
    subscribe: (listener: () => void) => () => void;
}

export function createStore<T>(initial: T): Store<T> {
    let value = initial;
    const listeners = new Set<() => void>();
    return {
        get: () => value,
        set: (next) => {
            value = next;
            listeners.forEach((listener) => listener());
        },
        subscribe: (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
    };
}

/** Current value of a store; re-renders when it changes */
export function useStore<T>(store: Store<T>, serverValue: T): T {
    return useSyncExternalStore(store.subscribe, store.get, () => serverValue);
}
