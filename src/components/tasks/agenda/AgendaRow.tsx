'use client';

import Link from 'next/link';
import { CheckCircle2, Circle, ListChecks, Repeat, UserRound } from '@/components/ui/icons';
import { useCanEdit } from '@/components/auth/AccessProvider';
import { occurrenceMenu } from '@/components/tasks/occurrence/occurrenceMenu';
import { DueLabel } from '@/components/tasks/shared/DueLabel';
import { OccurrenceStatusBadge, PostponedBadge, PriorityBadge } from '@/components/tasks/shared/TaskBadges';
import { ActionMenu } from '@/components/ui/ActionMenu';
import type { OccurrenceActions } from '@/hooks/useOccurrenceActions';
import { LINKS } from '@/config/navigation';
import type { AgendaItem } from '@/lib/tasks/types';
import { APP_COPY } from '@/locales';
import { cn } from '@/lib/utils';
import { DoneTick } from '@/components/tasks/shared/DoneTick';
import { linkClasses } from '@/components/ui/linkLook';

const copy = APP_COPY.tasks;

interface AgendaRowProps {
    item: AgendaItem;
    today: string;
    actions: OccurrenceActions;
    /** Show who is responsible (when the list holds more than one person) */
    showAssignee: boolean;
}

/** One line of "Da fare": tick to mark done, title to open the task, its badges, due date, "⋯" for the rest */
export function AgendaRow({ item, today, actions, showAssignee }: AgendaRowProps) {
    const canEdit = useCanEdit();
    const done = item.status === 'done';
    const ticked = item.checklistDone.length;

    return (
        <li className={cn('flex items-start gap-3 px-3 sm:px-4 py-2', done && 'opacity-70')}>
            {canEdit ? (
                <DoneTick
                    className="mt-0.5"
                    done={done}
                    disabled={actions.busy}
                    label={done ? copy.actions.reopen : copy.actions.markDone}
                    onClick={() => (done ? actions.reopen(item) : actions.done(item))}
                />
            ) : (
                <span className="mt-0.5 shrink-0 text-fg-faint">{done ? <CheckCircle2 size={20} /> : <Circle size={20} />}</span>
            )}

            <div className="flex-1 min-w-0">
                <Link href={`${LINKS.tasks.list}/${item.taskId}`} className={linkClasses('name', 'text-sm break-words', done && 'line-through text-fg-muted')}>
                    {item.title}
                </Link>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs text-fg-subtle">
                    <PriorityBadge priority={item.priority} />
                    {item.status !== 'open' && !done && <OccurrenceStatusBadge status={item.status} note={item.statusNote} />}
                    {!done && <PostponedBadge count={item.postponedCount} />}
                    {item.repeats && <Repeat size={12} aria-hidden />}
                    {item.areaName && <span>{item.areaName}</span>}
                    {item.checklistCount > 0 && (
                        <span className="inline-flex items-center gap-1">
                            <ListChecks size={12} />
                            {ticked}/{item.checklistCount}
                        </span>
                    )}
                    {showAssignee && item.assigneeName && (
                        <span className="inline-flex items-center gap-1">
                            <UserRound size={12} />
                            {item.assigneeName}
                        </span>
                    )}
                </div>
            </div>

            <DueLabel
                dueDate={item.dueDate}
                dueTime={item.dueTime}
                today={today}
                suggestedDate={item.suggestedDate}
                closedReason={item.closedReason}
                originalDate={item.originalDate}
                open={!done}
            />
            {canEdit && <ActionMenu actions={occurrenceMenu(item, item.repeats, actions)} />}
        </li>
    );
}
