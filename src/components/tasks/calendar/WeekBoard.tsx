'use client';

import { DayColumn } from '@/components/tasks/calendar/DayColumn';
import { OverdueDock } from '@/components/tasks/calendar/OverdueDock';
import { APP_CONFIG } from '@/config/constants';
import type { AgendaCalendar } from '@/hooks/useAgendaCalendar';
import type { CalendarDrag } from '@/hooks/useCalendarDrag';
import { weekDays } from '@/lib/tasks/week';
import { cn } from '@/lib/utils';

interface WeekBoardProps {
    calendar: AgendaCalendar;
    drag: CalendarDrag;
    canEdit: boolean;
}

/**
 * The week as seven columns, Monday to Sunday, today wider than the others; what is late in a strip above.
 * Desktop: it takes the free height and a busy day scrolls inside its own column. Phones: the days one under the other.
 */
export function WeekBoard({ calendar, drag, canEdit }: WeekBoardProps) {
    const { range, today, data, dayContent } = calendar;
    const days = weekDays(range.start);
    const counts = days.map((day) => {
        const content = dayContent(day);
        return content.open.length + content.done.length + content.planned.length;
    });
    const busiest = Math.max(APP_CONFIG.TASKS.DAY_FULL, ...counts);
    // Today takes more room (its cards show more); a closed day with nothing on it gives some away
    const { TODAY_COLUMN_WEIGHT, CLOSED_COLUMN_WEIGHT } = APP_CONFIG.TASKS;
    const weight = (day: string, index: number) => (day === today ? TODAY_COLUMN_WEIGHT : data?.closed[day] && counts[index] === 0 ? CLOSED_COLUMN_WEIGHT : 1);
    const columns = days.map((day, index) => `minmax(0, ${weight(day, index)}fr)`).join(' ');

    return (
        <div className="flex flex-col gap-2 lg:flex-1 lg:min-h-0">
            <OverdueDock items={data?.overdue ?? []} calendar={calendar} drag={drag} canEdit={canEdit} />
            <div
                className={cn(
                    'grid grid-cols-1 gap-2 md:[grid-template-columns:var(--week-columns)] lg:flex-1 lg:min-h-0 lg:grid-rows-[minmax(0,1fr)]',
                    !data && 'opacity-50 pointer-events-none'
                )}
                style={{ ['--week-columns' as string]: columns }}
            >
                {days.map((day) => (
                    <div key={day} className="flex md:min-h-96 lg:min-h-0">
                        <DayColumn date={day} content={dayContent(day)} calendar={calendar} drag={drag} canEdit={canEdit} closed={data?.closed[day]} busiest={busiest} />
                    </div>
                ))}
            </div>
        </div>
    );
}
