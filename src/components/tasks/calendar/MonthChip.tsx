'use client';

import { Repeat } from 'lucide-react';
import type { AgendaCalendar } from '@/hooks/useAgendaCalendar';
import type { CalendarDrag } from '@/hooks/useCalendarDrag';
import { isOpenStatus, type AgendaItem, type PlannedEntry } from '@/lib/tasks/types';
import { APP_COPY } from '@/locales';
import { cn } from '@/lib/utils';

const copy = APP_COPY.tasks.calendar;

/** One line of a month cell: a stored occurrence (draggable while open) or a planned date (dashed) */
export function MonthChip({ calendar, drag, canEdit, item, entry }: { calendar: AgendaCalendar; drag: CalendarDrag; canEdit: boolean; item?: AgendaItem; entry?: PlannedEntry }) {
    const { today, selected, select } = calendar;
    if (entry) {
        return (
            <button
                type="button"
                onClick={() => select({ kind: 'planned', entry })}
                data-calendar-card
                title={`${entry.title} — ${copy.plannedHint}`}
                className="w-full flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-2xs text-fg-subtle border border-dashed border-border-strong hover:text-fg-secondary"
            >
                <Repeat size={10} className="shrink-0" />
                <span className="truncate">{entry.title}</span>
            </button>
        );
    }
    if (!item) return null;
    const open = isOpenStatus(item.status);
    const late = open && item.dueDate !== null && item.dueDate < today;
    const isSelected = selected?.kind === 'item' && selected.item.id === item.id;
    return (
        <button
            type="button"
            {...(canEdit ? drag.cardProps(item) : {})}
            onClick={() => select({ kind: 'item', item })}
            data-calendar-card
            title={item.title}
            className={cn(
                'w-full flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-2xs transition-colors',
                !open ? 'text-fg-faint line-through' : late ? 'bg-danger-500/15 text-danger-300' : item.priority === 2 ? 'bg-danger-500/10 text-fg-strong' : 'bg-primary/10 text-fg hover:bg-primary/20',
                isSelected && 'ring-1 ring-primary'
            )}
        >
            {open && item.priority > 0 && <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', item.priority === 2 ? 'bg-danger-400' : 'bg-warning-400')} />}
            {item.dueTime && <span className="font-mono shrink-0">{item.dueTime}</span>}
            <span className="truncate">{item.title}</span>
        </button>
    );
}
