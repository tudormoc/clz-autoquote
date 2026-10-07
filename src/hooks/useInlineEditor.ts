'use client';

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';

/** Space (px) a popup under the input needs; with less room it opens above */
const POPUP_SPACE_PX = 140;

/** Whether a popup attached to `el` should open above it: last table row, or too little room below */
function shouldOpenAbove(el: HTMLElement): boolean {
    const bottom = el.getBoundingClientRect().bottom;
    const tr = el.closest('tr');
    if (tr && !tr.nextElementSibling) return true;

    const roomBelow = [window.innerHeight, el.closest('.overflow-x-auto')?.getBoundingClientRect().bottom, el.closest('main')?.getBoundingClientRect().bottom]
        .filter((edge): edge is number => edge !== undefined)
        .map((edge) => edge - bottom);
    return Math.min(...roomBelow) < POPUP_SPACE_PX;
}

interface Options<T> {
    /** Saves the value; return true to close the editor */
    onSave: (value: T) => Promise<boolean>;
    disabled?: boolean;
}

/**
 * State of a table cell edited in place with a text input and a popup of quick choices (hours, causali):
 * editing / saving flags, the typed text, focus, Enter / Escape, and where the popup opens.
 */
export function useInlineEditor<T>({ onSave, disabled }: Options<T>) {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState('');
    const [saving, setSaving] = useState(false);
    const [openAbove, setOpenAbove] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const place = useCallback((el?: HTMLElement | null) => {
        if (el) setOpenAbove(shouldOpenAbove(el));
    }, []);

    useEffect(() => {
        const input = inputRef.current;
        if (!isEditing || !input) return;
        input.focus();
        input.select();
        place(input);
        const onScroll = () => place(inputRef.current);
        window.addEventListener('scroll', onScroll, true);
        return () => window.removeEventListener('scroll', onScroll, true);
    }, [isEditing, place]);

    /** Opens the editor with `text` in the input */
    const start = (text: string, e?: MouseEvent<HTMLElement>) => {
        if (disabled || saving) return;
        place(e?.currentTarget);
        setEditValue(text);
        setIsEditing(true);
    };

    const cancel = () => {
        setIsEditing(false);
        setEditValue('');
    };

    /** Closes without saving (value unchanged) */
    const close = () => setIsEditing(false);

    const save = async (value: T) => {
        setSaving(true);
        try {
            if (await onSave(value)) setIsEditing(false);
        } finally {
            setSaving(false);
        }
    };

    /** Enter runs `commit`, Escape cancels */
    const keyDown = (commit: () => void) => (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            commit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancel();
        }
    };

    return { isEditing, editValue, setEditValue, saving, openAbove, inputRef, start, cancel, close, save, keyDown };
}
