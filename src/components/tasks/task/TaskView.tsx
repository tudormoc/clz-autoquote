'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Archive, BookOpen, CalendarCheck, Copy, Link2, ListChecks, Pause, Pencil, Play, RotateCcw, Trash2 } from '@/components/ui/icons';
import { setTaskStateAction, getTaskPageAction } from '@/app/tasks/task-actions';
import { useCanEdit } from '@/components/auth/AccessProvider';
import { PageHeader } from '@/components/layout/PageHeader';
import { OccurrenceDialog } from '@/components/tasks/occurrence/OccurrenceDialog';
import { ContactList } from '@/components/tasks/shared/ContactList';
import { confirmAndDeleteTask } from '@/components/tasks/shared/deleteTask';
import { Panel } from '@/components/ui/Panel';
import { LinkList } from '@/components/tasks/shared/LinkList';
import { LoadState } from '@/components/ui/LoadState';
import { QuickNotes } from '@/components/tasks/shared/QuickNotes';
import { OccurrenceCard } from '@/components/tasks/task/OccurrenceCard';
import { TaskInfo } from '@/components/tasks/task/TaskInfo';
import { TaskTimeline } from '@/components/tasks/task/TaskTimeline';
import { ActionMenu } from '@/components/ui/ActionMenu';
import type { MenuAction } from '@/components/ui/FloatingMenu';
import { buttonClasses } from '@/components/ui/Button';
import { LINKS } from '@/config/navigation';
import { useActionData } from '@/hooks/useActionData';
import { useOccurrenceActions } from '@/hooks/useOccurrenceActions';
import { askConfirm } from '@/lib/confirm';
import { notify } from '@/lib/notify';
import { isOpenStatus, type TaskState } from '@/lib/tasks/types';
import { APP_COPY, fmt } from '@/locales';
import { Surface } from '@/components/ui/Surface';

const copy = APP_COPY.tasks;

/** One task: its open occurrences to work on, how it is done, where things are, its past and its log */
export function TaskView({ id }: { id: number }) {
    const load = useCallback(() => getTaskPageAction(id), [id]);
    const { data, loading, error, reload } = useActionData(load);
    const canEdit = useCanEdit();
    const router = useRouter();
    const actions = useOccurrenceActions(reload, data?.data.today ?? '');
    if (!data) return <LoadState loading={loading} error={error} />;

    const { data: page, options } = data;
    const { task } = page;
    const titled = page.occurrences.map((occurrence) => ({ ...occurrence, title: task.title }));
    const open = titled.filter((occurrence) => isOpenStatus(occurrence.status));
    const closed = titled.filter((occurrence) => !isOpenStatus(occurrence.status));
    const guides = options.guides.filter((guide) => task.guideIds.includes(guide.id));
    const contacts = options.contacts.filter((contact) => task.contactIds.includes(contact.id));

    const changeState = async (state: TaskState, question?: string) => {
        if (question && !(await askConfirm({ title: task.title, message: question }))) return;
        try {
            const result = await setTaskStateAction(task.id, task.version, state);
            if (!result.success) notify.error(result.error);
            else notify.success(state === 'active' ? (task.state === 'archived' ? copy.messages.restored : copy.messages.resumed) : state === 'paused' ? copy.messages.paused : copy.messages.archived);
        } catch (err) {
            notify.failure(err);
        }
        await reload();
    };

    const menu: MenuAction[] = [
        { label: copy.actions.duplicate, icon: Copy, onSelect: () => router.push(`${LINKS.tasks.list}/new?copy=${task.id}`) },
        ...(task.state === 'active'
            ? [{ label: copy.actions.pause, icon: Pause, onSelect: () => changeState('paused', fmt(copy.dialogs.pauseConfirm, { title: task.title })) }]
            : task.state === 'paused'
              ? [{ label: copy.actions.resume, icon: Play, onSelect: () => changeState('active') }]
              : []),
        task.state === 'archived'
            ? { label: copy.actions.restore, icon: RotateCcw, onSelect: () => changeState('active') }
            : { label: copy.actions.archive, icon: Archive, tone: 'danger' as const, onSelect: () => changeState('archived', fmt(copy.dialogs.archiveConfirm, { title: task.title })) },
        ...(task.deletable
            ? [
                  {
                      label: copy.actions.deleteTask,
                      icon: Trash2,
                      tone: 'danger' as const,
                      divider: true,
                      onSelect: async () => {
                          if (await confirmAndDeleteTask(task)) router.push(LINKS.tasks.list);
                      },
                  },
              ]
            : []),
    ];

    return (
        <div className="flex flex-col lg:h-full">
            <PageHeader
                icon={ListChecks}
                title={task.title}
                subtitle={task.areaName ?? undefined}
                actions={
                    canEdit && (
                        <>
                            <Link href={`${LINKS.tasks.list}/${task.id}/edit`} className={buttonClasses({ variant: 'secondary' })}>
                                <Pencil size={16} />
                                {copy.actions.edit}
                            </Link>
                            <ActionMenu actions={menu} />
                        </>
                    )
                }
            />
            {/* Desktop: fits the screen; on wide screens each column scrolls on its own */}
            <div className="grid grid-cols-1 xl:grid-cols-3 xl:grid-rows-[minmax(0,1fr)] gap-4 items-start lg:flex-1 lg:min-h-0 lg:overflow-y-auto xl:overflow-hidden">
                <div className="xl:col-span-2 space-y-4 xl:max-h-full xl:overflow-y-auto xl:pr-1">
                    <Panel title={copy.detail.current} icon={CalendarCheck}>
                        {open.length === 0 ? (
                            <p className="text-sm text-fg-subtle">{copy.detail.noOpen}</p>
                        ) : (
                            open.map((occurrence, index) => (
                                <OccurrenceCard
                                    compact={index > 0}
                                    key={`${occurrence.id}:${occurrence.version}`}
                                    occurrence={occurrence}
                                    taskId={task.id}
                                    repeats={task.repeat !== null}
                                    checklist={task.checklist}
                                    comments={page.log.filter((entry) => entry.occurrenceId === occurrence.id && entry.action === 'comment')}
                                    today={page.today}
                                    actions={actions}
                                    reload={reload}
                                />
                            ))
                        )}
                    </Panel>

                    <Surface className="p-4 sm:p-5">
                        <QuickNotes taskId={task.id} version={task.version} notes={task.notes} onSaved={reload}>
                            {guides.length > 0 && (
                            <ul className="space-y-1">
                                {guides.map((guide) => (
                                    <li key={guide.id}>
                                        <Link href={`${LINKS.tasks.guides}/${guide.id}`} className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
                                            <BookOpen size={14} />
                                            {guide.title}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                        </QuickNotes>
                    </Surface>


                </div>

                <div className="space-y-4 xl:max-h-full xl:overflow-y-auto xl:pr-1">
                    <TaskInfo task={task} nextDates={page.nextDates} options={options} />
                    {(task.links.length > 0 || contacts.length > 0) && (
                        <Panel title={copy.form.sections.where} icon={Link2}>
                            <LinkList links={task.links} />
                            <ContactList contacts={contacts} />
                        </Panel>
                    )}
                    <TaskTimeline closed={closed} log={page.log} checklist={task.checklist} actions={actions} />
                </div>
            </div>

            {actions.dialog && (
                <OccurrenceDialog
                    kind={actions.dialog.kind}
                    occurrence={actions.dialog.occurrence}
                    today={page.today}
                    busy={actions.busy}
                    onSubmit={actions.submitDialog}
                    onClose={actions.close}
                />
            )}
        </div>
    );
}
