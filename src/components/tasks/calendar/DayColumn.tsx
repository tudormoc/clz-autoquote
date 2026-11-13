'use client';

import { useState } from 'react';
import { DayQuickAdd } from '@/components/tasks/calendar/DayQuickAdd';
import { PlannedCard } from '@/components/tasks/calendar/PlannedCard';
import { cardMenu } from '@/components/tasks/calendar/cardMenu';
import { WeekCard } from '@/components/tasks/calendar/WeekCard';
import type { AgendaCalendar, DayContent } from '@/hooks/useAgendaCalendar';
import type { CalendarDrag } from '@/hooks/useCalendarDrag';
import { dayOf, weekdayOf } from '@/lib/dateUtils';
import { APP_COPY, fmt } from '@/locales';
import { cn } from '@/lib/utils';
import { FoldToggle } from '@/components/ui/FoldToggle';
import { SURFACE_PENDING, SURFACE_SELECTED, surfaceClasses } from '@/components/ui/Surface';
import { Meter } from '@/components/ui/Meter';
import { Fold } from '@/components/ui/Fold';

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
 * One day of the week board: weekday and date, a bar of how full it is, its cards (open ones first, in their order,
 * then the planned ones), the done ones folded at the foot, "+ Aggiungi". Today stands out; closed days are dimmed;
 * while a card is dragged, the days that can take it light up and a line shows where it would land.
 */
export function DayColumn({ date, content, calendar, drag, canEdit, closed, busiest }: DayColumnProps) {
    const [showDone, setShowDone] = useState(false);
    const { today, selected, select, actions } = calendar;
    const isToday = date === today;
    const past = date < today;
    const count = content.open.length + content.done.length + content.planned.length;
    const droppable = drag.dragging !== null && drag.canDrop(date);
    const target = drag.target?.date === date ? drag.target : null;
    // A card from another day about to land here (a card changing place in its own day shows only the line)
    const dropping = target !== null && droppable;
    // The cards the dragged one would land between, and its place among them
    const others = content.open.filter((item) => item.id !== drag.dragging?.id);
    const slot = target?.slot ?? null;
    const empty = count === 0;

    return (
        <section
            {...(canEdit ? drag.dayProps(date) : {})}
            aria-label={fmt(copy.dayLoad, { n: count })}
            className={surfaceClasses(
                'inset',
                'group/day relative flex flex-1 flex-col min-w-0 transition-colors',
                isToday ? SURFACE_SELECTED : closed && 'border-border/60 bg-background',
                droppable && [SURFACE_PENDING, SURFACE_SELECTED],
                dropping && 'border-solid'
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
                <Meter size="sm" className="mt-1.5" tone={isToday ? 'primary' : 'neutral'} value={busiest > 0 ? count / busiest : 0} title={fmt(copy.dayLoad, { n: count })} />
            </header>

            <div className="flex-1 flex flex-col gap-1.5 px-1.5 pt-1 pb-1.5 lg:min-h-0 lg:overflow-y-auto">
                {dropping && others.length === 0 && (
                    <p className={surfaceClasses('inset', SURFACE_PENDING, SURFACE_SELECTED, 'px-2 py-2 text-center text-xs text-primary')}>{copy.dropHere}</p>
                )}
                {content.open.map((item) => {
                    const index = others.indexOf(item);
                    const line = slot === null || index < 0 ? null : slot === index ? 'top' : slot === others.length && index === others.length - 1 ? 'bottom' : null;
                    return (
                        <div key={item.id} className="relative">
                            {/* Where the dragged card would land: a line in the gap above or under this card */}
                            {line && <span aria-hidden className={cn('pointer-events-none absolute inset-x-0 h-0.5 rounded-full bg-primary', line === 'top' ? '-top-1' : '-bottom-1')} />}
                            <WeekCard
                                item={item}
                                today={today}
                                detailed={isToday}
                                selected={selected?.kind === 'item' && selected.item.id === item.id}
                                canEdit={canEdit}
                                busy={actions.busy}
                                drag={drag}
                                ordered
                                menu={canEdit ? cardMenu(item, calendar) : []}
                                onKey={canEdit ? (key) => calendar.cardKey(item, key) : undefined}
                                onOpen={() => select({ kind: 'item', item })}
                                onDone={() => actions.done(item)}
                            />
                        </div>
                    );
                })}
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
                        <FoldToggle size="sm" open={showDone} onClick={() => setShowDone(!showDone)} className="w-full py-1 text-2xs text-success-400">
                            {content.done.length === 1 ? copy.done.one : fmt(copy.done.many, { n: content.done.length })}
                        </FoldToggle>
                        <Fold open={showDone}>
                            {content.done.map((item) => (
                                <WeekCard
                                    key={item.id}
                                    item={item}
                                    today={today}
                                    detailed={false}
                                    selected={selected?.kind === 'item' && selected.item.id === item.id}
                                    canEdit={canEdit}
                                    busy={actions.busy}
                                    drag={drag}
                                    menu={canEdit ? cardMenu(item, calendar) : []}
                                    onOpen={() => select({ kind: 'item', item })}
                                    onDone={() => undefined}
                                />
                            ))}
                        </Fold>
                    </div>
                )}
                {canEdit && !past && (
                    <div className={cn(content.done.length === 0 && 'mt-auto')}>
                        <DayQuickAdd onAdd={(title) => calendar.addOn(date, title)} quiet={!empty} compact={!!closed && empty && !isToday} />
                    </div>
                )}
            </div>
        </section>
    );
}
