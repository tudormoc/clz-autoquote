'use client';

import { AlertTriangle } from 'lucide-react';
import { WeekCard } from '@/components/tasks/calendar/WeekCard';
import type { AgendaCalendar } from '@/hooks/useAgendaCalendar';
import type { CalendarDrag } from '@/hooks/useCalendarDrag';
import type { AgendaItem } from '@/lib/tasks/types';
import { APP_COPY } from '@/locales';

const copy = APP_COPY.tasks.calendar;

interface OverdueDockProps {
    items: AgendaItem[];
    calendar: AgendaCalendar;
    drag: CalendarDrag;
    canEdit: boolean;
}

/** What is late, in one slim row above the week whatever week is shown: tick it, open it, or drag it onto a day to postpone it */
export function OverdueDock({ items, calendar, drag, canEdit }: OverdueDockProps) {
    if (items.length === 0) return null;
    const { today, selected, select, actions } = calendar;

    return (
        <section className="flex items-center gap-2 rounded-lg border border-danger-500/30 bg-danger-500/5 p-1.5 pl-3 min-w-0">
            <h2 className="shrink-0 flex items-center gap-1.5 text-sm" title={canEdit ? copy.overdueHint : undefined}>
                <AlertTriangle size={14} className="text-danger-400" />
                <span className="font-semibold text-danger-300">{copy.overdue}</span>
                <span className="text-3xs px-1.5 rounded-full bg-danger-500/20 text-danger-300 font-mono">{items.length}</span>
            </h2>
            <div className="flex-1 min-w-0 flex gap-1.5 overflow-x-auto">
                {items.map((item) => (
                    <div key={item.id} className="shrink-0 w-64">
                        <WeekCard
                            item={item}
                            today={today}
                            detailed={false}
                            compact
                            selected={selected?.kind === 'item' && selected.item.id === item.id}
                            canEdit={canEdit}
                            busy={actions.busy}
                            drag={drag}
                            onOpen={() => select({ kind: 'item', item })}
                            onDone={() => actions.done(item)}
                        />
                    </div>
                ))}
            </div>
        </section>
    );
}
