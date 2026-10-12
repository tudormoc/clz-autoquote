'use client';

import { CalendarClock, Check, Hourglass, ListChecks, PlayCircle, Repeat } from 'lucide-react';
import { useAccess } from '@/components/auth/AccessProvider';
import type { CalendarDrag } from '@/hooks/useCalendarDrag';
import { formatShortDay, relativeDay } from '@/lib/tasks/describe';
import { isOpenStatus, type AgendaItem } from '@/lib/tasks/types';
import { APP_COPY, fmt } from '@/locales';
import { cn } from '@/lib/utils';

const copy = APP_COPY.tasks;

/** The coloured edge of a card: critica red, alta amber, normale none */
const EDGE = { 0: '', 1: 'bg-warning-500', 2: 'bg-danger-500' } as const;

interface WeekCardProps {
    item: AgendaItem;
    today: string;
    /** Today's column: more detail (area, who, the "meglio entro" hint in words) */
    detailed: boolean;
    /** One line only: tick, title, how late (the overdue strip) */
    compact?: boolean;
    selected: boolean;
    canEdit: boolean;
    busy: boolean;
    drag: CalendarDrag;
    onOpen: () => void;
    onDone: () => void;
}

/**
 * One occurrence on the week board: a tick to mark it done, its title, then small signs (time, in progress, waiting,
 * checklist, repeats, closed day). Click opens the side panel; drag moves it to another day. Done ones are struck through.
 */
export function WeekCard({ item, today, detailed, compact = false, selected, canEdit, busy, drag, onOpen, onDone }: WeekCardProps) {
    const open = isOpenStatus(item.status);
    const late = open && item.dueDate !== null && item.dueDate < today;
    const ticked = item.checklistDone.length;
    const dragging = drag.dragging?.id === item.id;
    // Who is responsible matters only when it is someone else
    const me = useAccess()?.name;
    const owner = item.assigneeName && item.assigneeName !== me ? item.assigneeName : null;

    return (
        <div
            {...(canEdit ? drag.cardProps(item) : {})}
            onClick={onOpen}
            onKeyDown={(event) => {
                if (event.key === 'Enter') onOpen();
            }}
            role="button"
            data-calendar-card
            tabIndex={0}
            title={open && canEdit ? copy.calendar.dragHint : undefined}
            className={cn(
                'group relative overflow-hidden rounded-md border bg-card pl-2.5 pr-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                compact ? 'py-1.5' : 'py-2',
                open ? 'border-border hover:border-border-strong hover:bg-muted/40 cursor-grab active:cursor-grabbing' : 'border-transparent bg-transparent hover:bg-muted/30 cursor-pointer',
                late && 'border-danger-500/40 bg-danger-500/5',
                selected && 'ring-1 ring-primary border-primary/60',
                dragging && 'opacity-40'
            )}
        >
            {open && item.priority > 0 && <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1', EDGE[item.priority])} />}
            <div className="flex items-start gap-2">
                <button
                    type="button"
                    disabled={!canEdit || busy || !open}
                    onClick={(event) => {
                        event.stopPropagation();
                        onDone();
                    }}
                    title={open ? copy.actions.markDone : copy.status.done}
                    aria-label={open ? copy.actions.markDone : copy.status.done}
                    className={cn(
                        'mt-px shrink-0 size-4 rounded-full border flex items-center justify-center transition-colors',
                        open ? 'border-fg-faint text-transparent hover:border-success-400 hover:text-success-400 disabled:hover:border-fg-faint disabled:hover:text-transparent' : 'border-success-500 bg-success-500 text-fg-inverse'
                    )}
                >
                    <Check size={10} strokeWidth={3} />
                </button>
                <span
                    className={cn(
                        'min-w-0 text-sm leading-snug',
                        compact ? 'flex-1 truncate' : 'break-words',
                        open ? 'font-medium text-fg-strong' : 'text-fg-muted line-through'
                    )}
                    title={compact ? item.title : undefined}
                >
                    {item.title}
                </span>
                {compact && late && item.dueDate && <span className="shrink-0 text-2xs text-danger-300">{relativeDay(item.dueDate, today)}</span>}
            </div>

            {open && !compact && (
                <div className="mt-1.5 pl-6 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-2xs text-fg-subtle">
                    {late && item.dueDate && <span className="text-danger-300">{relativeDay(item.dueDate, today)}</span>}
                    {item.dueTime && <span className="font-mono text-fg-secondary">{item.dueTime}</span>}
                    {item.status === 'progress' && (
                        <span className="inline-flex items-center gap-1 text-info-300">
                            <PlayCircle size={11} />
                            {copy.status.progress}
                        </span>
                    )}
                    {item.status === 'waiting' && (
                        <span className="inline-flex items-center gap-1 text-warning-300 min-w-0" title={item.statusNote ?? undefined}>
                            <Hourglass size={11} className="shrink-0" />
                            <span className="truncate max-w-32">{item.statusNote ?? copy.status.waiting}</span>
                        </span>
                    )}
                    {item.checklistCount > 0 && (
                        <span className="inline-flex items-center gap-1" title={copy.form.checklist}>
                            <ListChecks size={11} />
                            <span className="font-mono">
                                {ticked}/{item.checklistCount}
                            </span>
                            <span className="h-1 w-6 rounded-full bg-muted overflow-hidden">
                                <span className="block h-full bg-success-500" style={{ width: `${(ticked / item.checklistCount) * 100}%` }} />
                            </span>
                        </span>
                    )}
                    {item.repeats && <Repeat size={11} aria-label={copy.kinds.repeat} />}
                    {!late && item.suggestedDate && item.closedReason && (
                        <span className="inline-flex items-center gap-1 text-warning-300" title={fmt(copy.when.closedDay, { reason: item.closedReason, suggested: formatShortDay(item.suggestedDate) })}>
                            <CalendarClock size={11} />
                            {detailed && formatShortDay(item.suggestedDate)}
                        </span>
                    )}
                    {detailed && item.areaName && <span className="truncate max-w-32">{item.areaName}</span>}
                    {detailed && owner && <span className="truncate max-w-24">{owner}</span>}
                </div>
            )}
        </div>
    );
}
