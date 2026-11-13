'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BookOpen, CalendarClock, ExternalLink, Pencil, X } from '@/components/ui/icons';
import { getTaskPageAction } from '@/app/tasks/task-actions';
import { useCanEdit } from '@/components/auth/AccessProvider';
import { ContactList } from '@/components/tasks/shared/ContactList';
import { LinkList } from '@/components/tasks/shared/LinkList';
import { LoadState } from '@/components/ui/LoadState';
import { QuickNotes } from '@/components/tasks/shared/QuickNotes';
import { PriorityBadge } from '@/components/tasks/shared/TaskBadges';
import { ClosedOccurrences } from '@/components/tasks/task/ClosedOccurrences';
import { OccurrenceCard } from '@/components/tasks/task/OccurrenceCard';
import { buttonClasses } from '@/components/ui/Button';
import { LINKS } from '@/config/navigation';
import { useActionData } from '@/hooks/useActionData';
import type { AgendaCalendar, CalendarSelection } from '@/hooks/useAgendaCalendar';
import { describeRepeat, formatShortDay } from '@/lib/tasks/describe';
import { isOpenStatus } from '@/lib/tasks/types';
import { APP_COPY, fmt } from '@/locales';
import { surfaceClasses } from '@/components/ui/Surface';
import { IconButton } from '@/components/ui/IconButton';
import { titleClasses } from '@/components/ui/titleLook';

const copy = APP_COPY.tasks;

interface TaskPanelProps {
    selection: CalendarSelection;
    calendar: AgendaCalendar;
}

/**
 * The side panel of the calendar: everything needed to get one thing done without leaving the week — its due date
 * and state, Fatto, the checklist, the outcome, comments, how it is done, links, contacts. Escape, ✕ or a click
 * outside closes it.
 */
export function TaskPanel({ selection, calendar }: TaskPanelProps) {
    const taskId = selection.kind === 'item' ? selection.item.taskId : selection.entry.taskId;
    const load = useCallback(() => getTaskPageAction(taskId), [taskId]);
    const { data, loading, error } = useActionData(load);
    const canEdit = useCanEdit();
    const [shown, setShown] = useState(false);
    const panel = useRef<HTMLElement>(null);
    const { select, actions, refresh } = calendar;

    // Slides in after the first paint
    useEffect(() => {
        const frame = requestAnimationFrame(() => setShown(true));
        return () => cancelAnimationFrame(frame);
    }, []);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !actions.dialog) select(null);
        };
        // A click outside closes it too; not on another card (that one opens instead), a menu or a popup window
        const onClick = (event: MouseEvent) => {
            const target = event.target as Element | null;
            if (actions.dialog || !target?.isConnected || panel.current?.contains(target)) return;
            if (target.closest('[data-calendar-card], [role="menu"], [role="dialog"]')) return;
            select(null);
        };
        document.addEventListener('keydown', onKey);
        document.addEventListener('mousedown', onClick);
        return () => {
            document.removeEventListener('keydown', onKey);
            document.removeEventListener('mousedown', onClick);
        };
    }, [actions.dialog, select]);

    const task = data?.data.task;
    const occurrence = selection.kind === 'item' && data ? data.data.occurrences.find((o) => o.id === selection.item.id) ?? null : null;
    const guides = data && task ? data.options.guides.filter((guide) => task.guideIds.includes(guide.id)) : [];
    const contacts = data && task ? data.options.contacts.filter((contact) => task.contactIds.includes(contact.id)) : [];

    return (
        <aside
            ref={panel}
            aria-label={task?.title ?? copy.pages.list.label}
            className={surfaceClasses(
                'drawer',
                'fixed inset-y-0 right-0 z-40 w-full sm:w-panel flex flex-col border-l transition-transform duration-slide ease-out',
                shown ? 'translate-x-0' : 'translate-x-full'
            )}
        >
            <header className="flex items-start gap-3 p-4 border-b border-border">
                <div className="flex-1 min-w-0 space-y-1">
                    {task ? (
                        <>
                            <div className="flex flex-wrap items-center gap-2">
                                <PriorityBadge priority={task.priority} />
                                {task.areaName && <span className="text-xs text-fg-subtle">{task.areaName}</span>}
                            </div>
                            <Link href={`${LINKS.tasks.list}/${task.id}`} className="block text-base font-semibold text-fg-strong hover:text-primary break-words">
                                {task.title}
                            </Link>
                            <p className="text-xs text-fg-muted">{describeRepeat(task.repeat)}</p>
                        </>
                    ) : (
                        <p className="text-base font-semibold text-fg-strong break-words">{selection.kind === 'item' ? selection.item.title : selection.entry.title}</p>
                    )}
                </div>
                <IconButton size="sm"
                    type="button"
                    onClick={() => select(null)}
                    title={copy.calendar.closePanel}
                    aria-label={copy.calendar.closePanel}
                >
                    <X size={18} />
                </IconButton>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {!data || !task ? (
                    <LoadState loading={loading} error={error} />
                ) : (
                    <>
                        {selection.kind === 'planned' ? (
                            <p className="flex items-start gap-2 rounded-md border border-dashed border-border-strong p-3 text-sm text-fg-secondary">
                                <CalendarClock size={16} className="mt-0.5 shrink-0 text-fg-muted" />
                                {fmt(task.repeat?.mode === 'after' ? copy.calendar.plannedPanelAfter : copy.calendar.plannedPanel, {
                                    date: formatShortDay(selection.entry.date),
                                    days: task.showDays,
                                })}
                            </p>
                        ) : occurrence && isOpenStatus(occurrence.status) ? (
                            <OccurrenceCard
                                key={`${occurrence.id}:${occurrence.version}`}
                                occurrence={{ ...occurrence, title: task.title }}
                                taskId={task.id}
                                repeats={task.repeat !== null}
                                checklist={task.checklist}
                                comments={data.data.log.filter((entry) => entry.occurrenceId === occurrence.id && entry.action === 'comment')}
                                today={data.data.today}
                                actions={actions}
                                reload={refresh}
                            />
                        ) : occurrence ? (
                            <ClosedOccurrences occurrences={[{ ...occurrence, title: task.title }]} actions={actions} />
                        ) : null}

                        <QuickNotes taskId={task.id} version={task.version} notes={task.notes} onSaved={refresh}>
                            {guides.map((guide) => (
                                <Link key={guide.id} href={`${LINKS.tasks.guides}/${guide.id}`} className="flex items-center gap-2 text-sm text-primary hover:underline">
                                    <BookOpen size={14} />
                                    {guide.title}
                                </Link>
                            ))}
                        </QuickNotes>

                        {(task.links.length > 0 || contacts.length > 0) && (
                            <section className="space-y-2">
                                <h3 className={titleClasses('label')}>{copy.form.sections.where}</h3>
                                <LinkList links={task.links} />
                                <ContactList contacts={contacts} />
                            </section>
                        )}
                    </>
                )}
            </div>

            {task && (
                <footer className="flex gap-2 p-3 border-t border-border">
                    <Link href={`${LINKS.tasks.list}/${task.id}`} className={buttonClasses({ variant: 'secondary', size: 'sm', className: 'flex-1' })}>
                        <ExternalLink size={14} />
                        {copy.calendar.openTask}
                    </Link>
                    {canEdit && (
                        <Link href={`${LINKS.tasks.list}/${task.id}/edit`} className={buttonClasses({ variant: 'ghost', size: 'sm' })}>
                            <Pencil size={14} />
                            {copy.actions.edit}
                        </Link>
                    )}
                </footer>
            )}
        </aside>
    );
}
