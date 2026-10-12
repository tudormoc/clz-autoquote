'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { DayQuickAdd } from '@/components/tasks/calendar/DayQuickAdd';
import { PlannedCard } from '@/components/tasks/calendar/PlannedCard';
import { WeekCard } from '@/components/tasks/calendar/WeekCard';
import type { AgendaCalendar, DayContent } from '@/hooks/useAgendaCalendar';
import type { CalendarDrag } from '@/hooks/useCalendarDrag';
import { dayOf, weekdayOf } from '@/lib/tasks/dates';
import { APP_COPY, fmt } from '@/locales';
import { cn } from '@/lib/utils';

const copy = APP_COPY.tasks.calendar;

interface DayColumnProps {
    date: string;
    content: DayContent;
    calendar: AgendaCalendar;
    drag: CalendarDrag;
    canEdit: boolean;
    /** Why the office is closed that day, or undefined */
    closed?: string;
    /** A full bar means this many things due (a full day, or the busiest day of the week when busier) */
    busiest: number;
}

/**
 * One day of the week board: weekday and date, a bar of how full it is, its cards (open ones first, then the planned
 * ones), the done ones folded at the foot, "+ Aggiungi". Today stands out; closed days are dimmed; while a card is
 * dragged, the days that can take it light up.
 */
export function DayColumn({ date, content, calendar, drag, canEdit, closed, busiest }: DayColumnProps) {
    const [showDone, setShowDone] = useState(false);
    const { today, selected, select, actions } = calendar;
    const isToday = date === today;
    const past = date < today;
    const count = content.open.length + content.done.length + content.planned.length;
    const dropping = drag.over === date;
    const droppable = drag.dragging !== null && drag.canDrop(date);
    const empty = count === 0;

    return (
        <section
            {...(canEdit ? drag.dayProps(date) : {})}
            aria-label={fmt(copy.dayLoad, { n: count })}
            className={cn(
                'group/day relative flex flex-1 flex-col min-w-0 rounded-lg border transition-colors',
                isToday ? 'border-primary/50 bg-primary/5' : closed ? 'border-border/60 bg-background' : 'border-border bg-card/60',
                droppable && 'border-dashed border-primary/50',
                dropping && 'border-solid border-primary bg-primary/10'
            )}
        >
            <header className="shrink-0 px-2.5 pt-2 pb-1.5">
                <div className="flex items-baseline justify-between gap-2">
                    <span className={cn('text-xs', isToday ? 'text-primary font-semibold' : past ? 'text-fg-faint' : 'text-fg-muted')}>
                        {APP_COPY.weekdays.short[weekdayOf(date) - 1]}
                        {isToday && <span className="ml-1.5 font-normal">· {APP_COPY.tasks.when.today}</span>}
                        {isToday && count > content.planned.length && (
                            <span className="ml-1.5 font-mono font-normal text-fg-subtle">
                                {content.done.length}/{content.open.length + content.done.length}
                            </span>
                        )}
                    </span>
                    <span
                        className={cn(
                            'font-mono leading-none',
                            isToday ? 'text-xl font-semibold text-primary' : past ? 'text-base text-fg-faint' : 'text-base text-fg-secondary'
                        )}
                    >
                        {dayOf(date)}
                    </span>
                </div>
                {closed && closed !== APP_COPY.tasks.holidays.weekend && <p className="mt-0.5 truncate text-3xs text-warning-300">{closed}</p>}
                <div className="mt-1.5 h-1 rounded-full bg-muted/60 overflow-hidden" title={fmt(copy.dayLoad, { n: count })}>
                    <div
                        className={cn('h-full rounded-full transition-all', isToday ? 'bg-primary' : 'bg-fg-faint')}
                        style={{ width: `${busiest > 0 ? Math.round((count / busiest) * 100) : 0}%` }}
                    />
                </div>
            </header>

            <div className="flex-1 flex flex-col gap-1.5 px-1.5 pb-1.5 lg:min-h-0 lg:overflow-y-auto">
                {dropping && <p className="rounded-md border border-dashed border-primary px-2 py-2 text-center text-xs text-primary">{copy.dropHere}</p>}
                {content.open.map((item) => (
                    <WeekCard
                        key={item.id}
                        item={item}
                        today={today}
                        detailed={isToday}
                        selected={selected?.kind === 'item' && selected.item.id === item.id}
                        canEdit={canEdit}
                        busy={actions.busy}
                        drag={drag}
                        onOpen={() => select({ kind: 'item', item })}
                        onDone={() => actions.done(item)}
                    />
                ))}
                {content.planned.map((entry) => (
                    <PlannedCard
                        key={`${entry.taskId}:${entry.date}`}
                        entry={entry}
                        selected={selected?.kind === 'planned' && selected.entry.taskId === entry.taskId && selected.entry.date === entry.date}
                        onOpen={() => select({ kind: 'planned', entry })}
                    />
                ))}
                {empty && !dropping && <p className="hidden md:block py-3 text-center text-2xs text-fg-faint">{closed ?? copy.free}</p>}

                {content.done.length > 0 && (
                    <div className="mt-auto pt-1">
                        <button
                            type="button"
                            onClick={() => setShowDone(!showDone)}
                            aria-expanded={showDone}
                            className="w-full flex items-center gap-1 px-1.5 py-1 text-2xs text-success-400 hover:text-success-300"
                        >
                            <ChevronDown size={12} className={cn('transition-transform', !showDone && '-rotate-90')} />
                            {content.done.length === 1 ? copy.done.one : fmt(copy.done.many, { n: content.done.length })}
                        </button>
                        {showDone &&
                            content.done.map((item) => (
                                <WeekCard
                                    key={item.id}
                                    item={item}
                                    today={today}
                                    detailed={false}
                                    selected={selected?.kind === 'item' && selected.item.id === item.id}
                                    canEdit={canEdit}
                                    busy={actions.busy}
                                    drag={drag}
                                    onOpen={() => select({ kind: 'item', item })}
                                    onDone={() => undefined}
                                />
                            ))}
                    </div>
                )}
                {canEdit && !past && (
                    <div className={cn(content.done.length === 0 && 'mt-auto')}>
                        <DayQuickAdd onAdd={(title) => calendar.addOn(date, title)} quiet={!empty} />
                    </div>
                )}
            </div>
        </section>
    );
}
