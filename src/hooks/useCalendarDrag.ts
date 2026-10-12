'use client';

import { useState } from 'react';
import { isOpenStatus, type AgendaItem } from '@/lib/tasks/types';

/**
 * Drag an open occurrence onto another day to postpone it (week and month views). Only today and later days take a
 * drop; a card dropped on its own day does nothing. `onMove` saves.
 */
export function useCalendarDrag(today: string, onMove: (item: AgendaItem, date: string) => void) {
    const [dragging, setDragging] = useState<AgendaItem | null>(null);
    const [over, setOver] = useState<string | null>(null);

    const canDrop = (date: string) => dragging !== null && date >= today && date !== dragging.dueDate;
    const stop = () => {
        setDragging(null);
        setOver(null);
    };

    /** Props of a card: draggable while it is still to do */
    const cardProps = (item: AgendaItem): React.HTMLAttributes<HTMLElement> & { draggable?: boolean } =>
        isOpenStatus(item.status)
            ? {
                  draggable: true,
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
            if (!canDrop(date)) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            if (over !== date) setOver(date);
        },
        onDragLeave: (event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver((current) => (current === date ? null : current));
        },
        onDrop: (event) => {
            event.preventDefault();
            if (dragging && canDrop(date)) onMove(dragging, date);
            stop();
        },
    });

    return { dragging, over, cardProps, dayProps, canDrop };
}

export type CalendarDrag = ReturnType<typeof useCalendarDrag>;
