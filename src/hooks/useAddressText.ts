'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { APP_CONFIG } from '@/config/constants';

/**
 * A search box that filters as one types and whose text is also in the address. What is typed shows and filters at
 * once (kept here); it is written to the address a moment after the last key, on the same history step. An address
 * that changes on its own (Back, a link) fills the box.
 * `applied` is the text in the address, `write` puts a text there (`set({ q: text }, 'replace')` of useAddress).
 */
export function useAddressText(applied: string, write: (text: string) => void): [string, (text: string) => void] {
    const [text, setText] = useState(applied);
    /** The last text this box put in the address, or saw there */
    const sent = useRef(applied);
    const timer = useRef<number | undefined>(undefined);
    const writeRef = useRef(write);
    useEffect(() => {
        writeRef.current = write;
    });

    useEffect(() => {
        // Its own text coming back from the address changes nothing; any other text is a new address
        if (applied === sent.current) return;
        sent.current = applied;
        window.clearTimeout(timer.current);
        setText(applied);
    }, [applied]);

    useEffect(() => () => window.clearTimeout(timer.current), []);

    const type = useCallback((next: string) => {
        setText(next);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => {
            sent.current = next;
            writeRef.current(next);
        }, APP_CONFIG.TASKS.SEARCH_DELAY_MS);
    }, []);

    return [text, type];
}
