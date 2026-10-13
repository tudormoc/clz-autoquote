'use client';

import { useState } from 'react';
import { FINE_POINTER, useMediaQuery } from '@/hooks/useMediaQuery';
import { isOpenStatus, type AgendaItem } from '@/lib/tasks/types';

/** Where a dragged card would land: a day, and its place among that day's cards (null = after them / unchanged) */
export interface DropTarget {
    date: string;
    slot: number | null;
}

/** Attribute of the cards a day lays out in order (week board): its value is the occurrence id */
const ORDERED_CARD = 'data-day-card';

/**
 * Where among a day's cards the mouse is: how many of the other cards lie above it. On the card's own day null when
 * that is where it already stands; on another day null when the day has no ordered cards (empty, or a month cell).
 */
function slotAt(day: HTMLElement, id: number, y: number, ownDay: boolean): number | null {
    const cards = Array.from(day.querySelectorAll<HTMLElement>(`[${ORDERED_CARD}]`));
    const isDragged = (card: HTMLElement) => card.getAttribute(ORDERED_CARD) === String(id);
    const slot = cards.filter((card) => {
        if (isDragged(card)) return false;
        const box = card.getBoundingClientRect();
        return box.top + box.height / 2 < y;
    }).length;
    if (ownDay) return slot === cards.findIndex(isDragged) ? null : slot;
    return cards.length === 0 ? null : slot;
}

/**
 * Drag an open card onto another day to postpone it, or up and down inside its own day (week board) to change its
 * place. Only today and later days take a drop. `onDrop` gets the card, the day and the place (`DropTarget.slot`).
 * Only with a mouse: on a touch screen holding a card opens its menu instead (`useContextMenu`).
 */
export function useCalendarDrag(today: string, onDrop: (item: AgendaItem, date: string, slot: number | null) => void) {
    const [dragging, setDragging] = useState<AgendaItem | null>(null);
    const [target, setTarget] = useState<DropTarget | null>(null);
    const mouse = useMediaQuery(FINE_POINTER, true);

    /** Another day the dragged card can be postponed to */
    const canDrop = (date: string) => dragging !== null && date >= today && date !== dragging.dueDate;
    const stop = () => {
        setDragging(null);
        setTarget(null);
    };

    /** The place the dragged card would take on `date`, or undefined when that day does not take it */
    const placeOn = (event: React.DragEvent<HTMLElement>, date: string): number | null | undefined => {
        if (!dragging || date < today) return undefined;
        const ownDay = date === dragging.dueDate;
        // A month cell has no ordered cards: the card's own day there takes nothing
        if (ownDay && !event.currentTarget.querySelector(`[${ORDERED_CARD}]`)) return undefined;
        return slotAt(event.currentTarget, dragging.id, event.clientY, ownDay);
    };

    /** Props of a card: draggable while it is still to do; `ordered` = one of the cards its day lays out in order */
    const cardProps = (item: AgendaItem, ordered = false): React.HTMLAttributes<HTMLElement> & { draggable?: boolean } =>
        isOpenStatus(item.status) && mouse
            ? {
                  draggable: true,
                  ...(ordered ? { [ORDERED_CARD]: item.id } : {}),
                  onDragStart: (event) => {
                      event.dataTransfer.setData('text/plain', String(item.id));
                      event.dataTransfer.effectAllowed = 'move';
                      setDragging(item);
                  },
                  onDragEnd: stop,
              }
            : {};

    /** Props of a day (column or cell) that takes drops */
    const dayProps = (date: string): React.HTMLAttributes<HTMLElement> => ({
        onDragOver: (event) => {
            const slot = placeOn(event, date);
            if (slot === undefined) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            if (target?.date !== date || target.slot !== slot) setTarget({ date, slot });
        },
        onDragLeave: (event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setTarget((current) => (current?.date === date ? null : current));
        },
        onDrop: (event) => {
            event.preventDefault();
            const slot = placeOn(event, date);
            if (dragging && slot !== undefined) onDrop(dragging, date, slot);
            stop();
        },
    });

    return { dragging, target, cardProps, dayProps, canDrop };
}

export type CalendarDrag = ReturnType<typeof useCalendarDrag>;
