import { formatShortDay, relativeDay } from '@/lib/tasks/describe';
import { APP_COPY, fmt } from '@/locales';
import { cn } from '@/lib/utils';

interface DueLabelProps {
    dueDate: string | null;
    dueTime?: string | null;
    today: string;
    /** The working day before, when the date is a closed day */
    suggestedDate?: string | null;
    closedReason?: string | null;
    /** The date it had before "Rimanda" */
    originalDate?: string | null;
    /** Late colouring only for things still to do */
    open?: boolean;
}

/** "ven 16/10 · tra 7 giorni", red when late, with the "meglio entro" hint on a closed day */
export function DueLabel({ dueDate, dueTime, today, suggestedDate, closedReason, originalDate, open = true }: DueLabelProps) {
    const when = APP_COPY.tasks.when;
    if (!dueDate) return <span className="text-fg-faint">{APP_COPY.tasks.repeat.noDate}</span>;
    const late = open && dueDate < today;
    const isToday = dueDate === today;

    return (
        <span className="inline-flex flex-col items-end text-right leading-tight">
            <span className={cn('font-mono text-sm whitespace-nowrap', late ? 'text-danger-400' : isToday ? 'text-warning-300' : 'text-fg-secondary')}>
                {formatShortDay(dueDate)}
                {dueTime && <span className="text-fg-muted"> {dueTime}</span>}
            </span>
            {open && <span className={cn('text-2xs', late ? 'text-danger-400' : 'text-fg-subtle')}>{relativeDay(dueDate, today)}</span>}
            {open && !late && suggestedDate && closedReason && (
                <span className="text-2xs text-warning-300 sm:whitespace-nowrap">
                    {fmt(when.closedDay, { reason: closedReason, suggested: formatShortDay(suggestedDate) })}
                </span>
            )}
            {originalDate && originalDate !== dueDate && (
                <span className="text-2xs text-fg-faint whitespace-nowrap">{fmt(APP_COPY.tasks.detail.originalDate, { date: formatShortDay(originalDate) })}</span>
            )}
        </span>
    );
}
