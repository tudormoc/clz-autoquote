'use client';

import type { LucideIcon } from '@/components/ui/icons';
import { WeekCard } from '@/components/tasks/calendar/WeekCard';
import { cardMenu } from '@/components/tasks/calendar/cardMenu';
import type { AgendaCalendar } from '@/hooks/useAgendaCalendar';
import type { CalendarDrag } from '@/hooks/useCalendarDrag';
import type { AgendaItem } from '@/lib/tasks/types';
import { titleClasses } from '@/components/ui/titleLook';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { SURFACE_TONE, surfaceClasses } from '@/components/ui/Surface';

/** Late ones in red; the ones without a date quiet */
const TONES = {
    danger: { box: SURFACE_TONE.danger, icon: 'text-danger-400', title: 'text-danger-300', count: 'danger' },
    muted: { box: undefined, icon: 'text-fg-muted', title: undefined, count: 'neutral' },
} as const;

interface CardDockProps {
    title: string;
    /** What dragging does (tooltip of the title, for those who may change) */
    hint: string;
    icon: LucideIcon;
    tone: keyof typeof TONES;
    items: AgendaItem[];
    calendar: AgendaCalendar;
    drag: CalendarDrag;
    canEdit: boolean;
}

/**
 * A slim row of cards above the calendar, whatever period is shown: what is late ("Scadute") or has no date yet
 * ("Senza data"). Tick a card, open it, right-click it, or drag it onto a day.
 */
export function CardDock({ title, hint, icon: Icon, tone, items, calendar, drag, canEdit }: CardDockProps) {
    if (items.length === 0) return null;
    const { today, selected, select, actions } = calendar;
    const look = TONES[tone];

    return (
        <section className={surfaceClasses('inset', 'shrink-0 flex items-center gap-2 p-1.5 pl-3 min-w-0', look.box)}>
            <h2 className={titleClasses('section', 'shrink-0 flex items-center gap-1.5')} title={canEdit ? hint : undefined}>
                <Icon size={14} className={look.icon} />
                <span className={look.title}>{title}</span>
                <StatusBadge tone={look.count} mono>
                    {items.length}
                </StatusBadge>
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
                            menu={canEdit ? cardMenu(item, calendar) : []}
                            onKey={canEdit ? (key) => calendar.cardKey(item, key) : undefined}
                            onOpen={() => select({ kind: 'item', item })}
                            onDone={() => actions.done(item)}
                        />
                    </div>
                ))}
            </div>
        </section>
    );
}
