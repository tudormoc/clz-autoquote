'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { Archive, BadgeCheck, BookOpen, Link2, ListChecks, Pencil, RotateCcw } from '@/components/ui/icons';
import { getGuideAction, markGuideReviewedAction, setGuideStateAction } from '@/app/tasks/guide-actions';
import type { Saved } from '@/app/tasks/results';
import { useCanEdit } from '@/components/auth/AccessProvider';
import { PageHeader } from '@/components/layout/PageHeader';
import { GuideVersions } from '@/components/tasks/guides/GuideVersions';
import { ReviewBadge } from '@/components/tasks/guides/ReviewBadge';
import { ContactList } from '@/components/tasks/shared/ContactList';
import { Panel } from '@/components/ui/Panel';
import { LinkList } from '@/components/tasks/shared/LinkList';
import { LoadState } from '@/components/ui/LoadState';
import { TaskStateBadge } from '@/components/tasks/shared/TaskBadges';
import { ActionMenu } from '@/components/ui/ActionMenu';
import type { MenuAction } from '@/components/ui/FloatingMenu';
import { buttonClasses } from '@/components/ui/Button';
import { Markdown } from '@/components/ui/Markdown';
import { LINKS } from '@/config/navigation';
import { useActionData } from '@/hooks/useActionData';
import { askConfirm } from '@/lib/confirm';
import { notify } from '@/lib/notify';
import { formatMoment } from '@/lib/tasks/describe';
import { APP_COPY, fmt } from '@/locales';

const copy = APP_COPY.tasks;

/** One procedure: its steps, links, contacts, the tasks using it, its earlier versions */
export function GuideView({ id }: { id: number }) {
    const load = useCallback(() => getGuideAction(id), [id]);
    const { data, loading, error, reload } = useActionData(load);
    const canEdit = useCanEdit();
    if (!data) return <LoadState loading={loading} error={error} />;
    const { guide } = data;
    const contacts = data.contacts.filter((contact) => guide.contactIds.includes(contact.id));

    const run = async (save: Promise<Saved>, success: string, question?: string) => {
        if (question && !(await askConfirm({ title: guide.title, message: question }))) return;
        try {
            const result = await save;
            if (result.success) notify.success(success);
            else notify.error(result.error);
        } catch (err) {
            notify.failure(err);
        }
        await reload();
    };

    const menu: MenuAction[] = [
        { label: copy.guides.markReviewed, icon: BadgeCheck, onSelect: () => run(markGuideReviewedAction(guide.id, guide.version), copy.guides.reviewedNow) },
        guide.state === 'active'
            ? {
                  label: copy.actions.archive,
                  icon: Archive,
                  tone: 'danger',
                  onSelect: () => run(setGuideStateAction(guide.id, guide.version, 'archived'), copy.messages.archived, fmt(copy.guides.archiveConfirm, { title: guide.title })),
              }
            : { label: copy.actions.restore, icon: RotateCcw, onSelect: () => run(setGuideStateAction(guide.id, guide.version, 'active'), copy.messages.restored) },
    ];

    return (
        <div className="flex flex-col lg:h-full">
            <PageHeader
                icon={BookOpen}
                title={guide.title}
                subtitle={
                    <span className="inline-flex flex-wrap items-center gap-2">
                        {guide.areaName && <span>{guide.areaName}</span>}
                        <ReviewBadge guide={guide} />
                        {guide.state === 'archived' && <span className="text-fg-faint">{copy.states.archived}</span>}
                    </span>
                }
                actions={
                    canEdit && (
                        <>
                            <Link href={`${LINKS.tasks.guides}/${guide.id}/edit`} className={buttonClasses({ variant: 'secondary' })}>
                                <Pencil size={16} />
                                {copy.actions.edit}
                            </Link>
                            <ActionMenu actions={menu} />
                        </>
                    )
                }
            />
            <div className="grid grid-cols-1 xl:grid-cols-3 xl:grid-rows-[minmax(0,1fr)] gap-4 items-start lg:flex-1 lg:min-h-0 lg:overflow-y-auto xl:overflow-hidden">
                <div className="xl:col-span-2 space-y-4 xl:max-h-full xl:overflow-y-auto xl:pr-1">
                    <Panel title={copy.guides.body} icon={BookOpen}>
                        {guide.body.trim() ? <Markdown text={guide.body} /> : <p className="text-sm text-fg-subtle">{copy.detail.notesEmpty}</p>}
                    </Panel>
                    {(guide.links.length > 0 || contacts.length > 0) && (
                        <Panel title={copy.form.sections.where} icon={Link2}>
                            <LinkList links={guide.links} />
                            <ContactList contacts={contacts} />
                        </Panel>
                    )}
                </div>
                <div className="space-y-4 xl:max-h-full xl:overflow-y-auto xl:pr-1">
                    <Panel title={copy.guides.usedBy} icon={ListChecks}>
                        {guide.tasks.length === 0 ? (
                            <p className="text-sm text-fg-subtle">{copy.guides.notUsed}</p>
                        ) : (
                            <ul className="space-y-1.5">
                                {guide.tasks.map((task) => (
                                    <li key={task.id} className="flex items-center justify-between gap-2">
                                        <Link href={`${LINKS.tasks.list}/${task.id}`} className="text-sm text-primary hover:underline">
                                            {task.title}
                                        </Link>
                                        {task.state !== 'active' && <TaskStateBadge state={task.state} />}
                                    </li>
                                ))}
                            </ul>
                        )}
                        <div className="pt-2 border-t border-border text-2xs text-fg-subtle space-y-0.5">
                            <p>{fmt(copy.detail.createdBy, { name: guide.createdBy, date: formatMoment(guide.createdAt) })}</p>
                            <p>{fmt(copy.detail.updatedBy, { name: guide.updatedBy, date: formatMoment(guide.updatedAt) })}</p>
                        </div>
                    </Panel>
                    <GuideVersions guide={guide} reload={reload} />
                </div>
            </div>
        </div>
    );
}
