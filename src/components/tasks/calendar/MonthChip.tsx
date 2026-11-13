'use client';

import { cardMenu } from '@/components/tasks/calendar/cardMenu';
import { PlannedCard } from '@/components/tasks/calendar/PlannedCard';
import { FloatingMenu } from '@/components/ui/FloatingMenu';
import { SurfaceButton } from '@/components/ui/SurfaceButton';
import type { AgendaCalendar } from '@/hooks/useAgendaCalendar';
import type { CalendarDrag } from '@/hooks/useCalendarDrag';
import { useContextMenu } from '@/hooks/useContextMenu';
import { isOpenStatus, type AgendaItem, type PlannedEntry } from '@/lib/tasks/types';
import { cn } from '@/lib/utils';

/** One line of a month cell: a stored occurrence (draggable while open, right-click for its actions) or a planned date (dashed) */
export function MonthChip({ calendar, drag, canEdit, item, entry }: { calendar: AgendaCalendar; drag: CalendarDrag; canEdit: boolean; item?: AgendaItem; entry?: PlannedEntry }) {
    const { today, selected, select } = calendar;
    const contextMenu = useContextMenu();
    if (entry) {
        return (
            <PlannedCard
                compact
                entry={entry}
                selected={selected?.kind === 'planned' && selected.entry.taskId === entry.taskId && selected.entry.date === entry.date}
                onOpen={() => select({ kind: 'planned', entry })}
            />
        );
    }
    if (!item) return null;
    const open = isOpenStatus(item.status);
    const late = open && item.dueDate !== null && item.dueDate < today;
    const critical = open && item.priority === 2;
    const menu = canEdit ? cardMenu(item, calendar) : [];
    return (
        <>
            <SurfaceButton
                {...(canEdit ? drag.cardProps(item) : {})}
                tone={late || critical ? 'danger' : undefined}
                bare={!open}
                selected={selected?.kind === 'item' && selected.item.id === item.id}
                onClick={() => select({ kind: 'item', item })}
                onContextMenu={menu.length > 0 ? contextMenu.open : undefined}
                data-calendar-card
                title={item.title}
                className={cn(
                    'w-full flex items-center gap-1 truncate px-1.5 py-0.5 text-2xs',
                    !open ? 'text-fg-faint line-through' : late ? 'text-danger-300' : critical ? 'text-fg-strong' : 'text-fg'
                )}
            >
                {open && item.priority > 0 && <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', critical ? 'bg-danger-400' : 'bg-warning-400')} />}
                {item.dueTime && <span className="font-mono shrink-0">{item.dueTime}</span>}
                <span className="truncate">{item.title}</span>
            </SurfaceButton>
            {contextMenu.at && <FloatingMenu actions={menu} anchor={contextMenu.at} onClose={contextMenu.close} />}
        </>
    );
}
