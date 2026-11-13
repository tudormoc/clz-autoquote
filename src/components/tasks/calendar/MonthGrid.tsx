'use client';

import { MonthChip } from '@/components/tasks/calendar/MonthChip';
import { EmptyState } from '@/components/ui/EmptyState';
import { APP_CONFIG } from '@/config/constants';
import type { AgendaCalendar } from '@/hooks/useAgendaCalendar';
import type { CalendarDrag } from '@/hooks/useCalendarDrag';
import { addDays, dayOf } from '@/lib/dateUtils';
import { formatShortDay } from '@/lib/tasks/describe';
import { monthKey } from '@/lib/tasks/week';
import { APP_COPY, fmt } from '@/locales';
import { cn } from '@/lib/utils';
import { surfaceClasses } from '@/components/ui/Surface';
import { TextButton } from '@/components/ui/TextButton';
import { titleClasses } from '@/components/ui/titleLook';

const copy = APP_COPY.tasks.calendar;

interface MonthGridProps {
    calendar: AgendaCalendar;
    drag: CalendarDrag;
    canEdit: boolean;
}

/** The month as a grid of whole weeks; cards drag onto another day; "+N" opens that week. Phones: the days that have something. */
export function MonthGrid({ calendar, drag, canEdit }: MonthGridProps) {
    const { range, today, anchor, data, dayContent, goTo } = calendar;
    const days: string[] = [];
    for (let day = range.start; day <= range.end; day = addDays(day, 1)) days.push(day);
    const inMonth = (day: string) => monthKey(day) === monthKey(anchor);
    const max = APP_CONFIG.TASKS.CALENDAR_MAX_PER_DAY;
    const daysWithEntries = days.filter((day) => {
        const content = dayContent(day);
        return inMonth(day) && content.open.length + content.done.length + content.planned.length > 0;
    });
    const openWeek = (day: string) => goTo(day, 'week');

    return (
        <div className="lg:flex-1 lg:min-h-0 flex flex-col">
            {/* Desktop: whole weeks share the free height; a full day shows "+N" rather than growing */}
            <div
                className={surfaceClasses('panel', 'hidden md:grid grid-cols-7 overflow-hidden lg:flex-1 lg:min-h-0', !data && 'opacity-50')}
                style={{ gridTemplateRows: `auto repeat(${days.length / 7}, minmax(0, 1fr))` }}
            >
                {APP_COPY.weekdays.short.map((name) => (
                    <div key={name} className={titleClasses('label', 'px-2 py-1.5 border-b border-border bg-muted/40')}>
                        {name}
                    </div>
                ))}
                {days.map((day) => {
                    const content = dayContent(day);
                    const chips = [
                        ...content.open.map((item) => ({ key: `o${item.id}`, item })),
                        ...content.planned.map((entry) => ({ key: `p${entry.taskId}:${entry.date}`, entry })),
                        ...content.done.map((item) => ({ key: `d${item.id}`, item })),
                    ];
                    const closed = data?.closed[day];
                    return (
                        <div
                            key={day}
                            {...(canEdit ? drag.dayProps(day) : {})}
                            title={closed ? fmt(copy.closed, { reason: closed }) : undefined}
                            className={cn(
                                'min-h-28 lg:min-h-0 overflow-hidden p-1.5 border-b border-r border-border/60 space-y-1 transition-colors',
                                closed && 'bg-background',
                                day === today && 'bg-primary/5',
                                !inMonth(day) && 'opacity-40',
                                drag.dragging && drag.canDrop(day) && 'bg-primary/5',
                                drag.target?.date === day && 'bg-primary/15'
                            )}
                        >
                            <div className="flex items-center justify-between gap-1">
                                <TextButton
                                    onClick={() => openWeek(day)}
                                    className={cn('px-1.5 text-xs font-mono', day === today ? 'font-semibold text-primary' : closed ? 'text-fg-faint' : 'text-fg-secondary')}
                                >
                                    {dayOf(day)}
                                </TextButton>
                                {closed && closed !== APP_COPY.tasks.holidays.weekend && <span className="truncate text-3xs text-warning-300">{closed}</span>}
                            </div>
                            {chips.slice(0, max).map((chip) => (
                                <MonthChip key={chip.key} calendar={calendar} drag={drag} canEdit={canEdit} item={'item' in chip ? chip.item : undefined} entry={'entry' in chip ? chip.entry : undefined} />
                            ))}
                            {chips.length > max && (
                                <TextButton onClick={() => openWeek(day)} className="px-1 text-3xs">
                                    {fmt(copy.more, { n: chips.length - max })}
                                </TextButton>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="md:hidden space-y-3">
                {daysWithEntries.length === 0 ? (
                    <EmptyState title={copy.empty} />
                ) : (
                    daysWithEntries.map((day) => {
                        const content = dayContent(day);
                        return (
                            <section key={day} className={surfaceClasses('panel', 'p-3 space-y-1.5')}>
                                <h3 className={titleClasses('section', day === today && 'text-primary')}>{formatShortDay(day)}</h3>
                                {content.open.map((item) => (
                                    <MonthChip key={item.id} calendar={calendar} drag={drag} canEdit={false} item={item} />
                                ))}
                                {content.planned.map((entry) => (
                                    <MonthChip key={`${entry.taskId}:${entry.date}`} calendar={calendar} drag={drag} canEdit={false} entry={entry} />
                                ))}
                                {content.done.map((item) => (
                                    <MonthChip key={item.id} calendar={calendar} drag={drag} canEdit={false} item={item} />
                                ))}
                            </section>
                        );
                    })
                )}
            </div>
        </div>
    );
}
