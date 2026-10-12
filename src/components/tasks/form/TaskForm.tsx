'use client';

import { Fragment } from 'react';
import { BookOpen, FileText, Link2, UsersRound } from 'lucide-react';
import { ChecklistEditor } from '@/components/tasks/form/ChecklistEditor';
import { WhenCard } from '@/components/tasks/form/WhenCard';
import { AgendaForm } from '@/components/tasks/shared/AgendaForm';
import { FormCard } from '@/components/tasks/shared/FormCard';
import { LinksEditor } from '@/components/tasks/shared/LinksEditor';
import { LoadState } from '@/components/tasks/shared/LoadState';
import { MultiPick } from '@/components/tasks/shared/MultiPick';
import { ChoiceButton } from '@/components/ui/ChoiceButton';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { MarkdownField } from '@/components/ui/MarkdownField';
import { Select } from '@/components/ui/Select';
import { TASK_PAGES } from '@/config/navigation';
import { useTaskForm } from '@/hooks/useTaskForm';
import { PRIORITIES, VISIBILITIES, type Visibility } from '@/lib/tasks/types';
import { APP_COPY } from '@/locales';

const copy = APP_COPY.tasks;
const form = copy.form;

/** Create (id null, or a copy of `copyFrom`) or change a task; saving opens its page */
export function TaskForm({ id, copyFrom }: { id: number | null; copyFrom: number | null }) {
    const { draft, options, loading, error, saving, set, setRepeat, save } = useTaskForm(id, copyFrom);
    if (!draft || !options) return <LoadState loading={loading} error={error} />;

    const cancelHref = id ? `${TASK_PAGES.list}/${id}` : TASK_PAGES.list;
    const guideOptions = options.guides
        .filter((guide) => guide.state === 'active' || draft.guideIds.includes(guide.id))
        .map((guide) => ({ id: guide.id, label: guide.title, detail: guide.areaName ?? undefined }));
    const contactOptions = options.contacts
        .filter((contact) => contact.state === 'active' || draft.contactIds.includes(contact.id))
        .map((contact) => ({ id: contact.id, label: contact.name, detail: [contact.role, contact.company].filter(Boolean).join(' · ') || undefined }));

    return (
        <AgendaForm
            onSave={save}
            saving={saving}
            cancelHref={cancelHref}
            saveLabel={id === null ? form.create : form.save}
            columns={[
                <Fragment key="what-when">
                    <FormCard title={form.sections.what} icon={FileText}>
                        <Field label={form.title} htmlFor="task-title">
                            <Input id="task-title" value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder={form.titlePlaceholder} maxLength={200} autoFocus={id === null} />
                        </Field>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label={form.area} htmlFor="task-area">
                                <Select
                                    id="task-area"
                                    value={draft.areaId}
                                    onChange={(e) => set({ areaId: e.target.value })}
                                    options={[{ value: '', label: form.noArea }, ...options.areas.map((area) => ({ value: String(area.id), label: area.name }))]}
                                />
                            </Field>
                            <Field label={form.tags} htmlFor="task-tags">
                                <Input id="task-tags" value={draft.tags} onChange={(e) => set({ tags: e.target.value })} placeholder={form.tagsPlaceholder} />
                            </Field>
                        </div>
                        <Field label={form.priority}>
                            <div className="flex flex-wrap gap-2">
                                {PRIORITIES.map((priority) => (
                                    <ChoiceButton key={priority} size="sm" className="px-3" selected={draft.priority === priority} onClick={() => set({ priority })} title={copy.priorityHint[priority] || undefined}>
                                        {copy.priority[priority]}
                                    </ChoiceButton>
                                ))}
                            </div>
                        </Field>
                    </FormCard>

                    <WhenCard draft={draft} today={options.today} closedDays={options.closedDays} set={set} setRepeat={setRepeat} />
                </Fragment>,
                <Fragment key="who-how-where">
                    <FormCard title={form.sections.who} icon={UsersRound}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label={form.assignee} htmlFor="task-assignee">
                                <Select
                                    id="task-assignee"
                                    value={draft.assignee}
                                    onChange={(e) => set({ assignee: e.target.value })}
                                    options={[{ value: '', label: form.nobody }, ...options.people.map((person) => ({ value: person.key, label: person.name }))]}
                                />
                            </Field>
                            <Field label={form.visibility} htmlFor="task-visibility">
                                <Select
                                    id="task-visibility"
                                    value={draft.visibility}
                                    onChange={(e) => set({ visibility: e.target.value as Visibility })}
                                    options={VISIBILITIES.filter((v) => v !== 'group' || options.groups.length > 0).map((v) => ({ value: v, label: copy.visibility[v] }))}
                                />
                            </Field>
                            {draft.visibility === 'group' && (
                                <Field label={form.group} htmlFor="task-group">
                                    <Select
                                        id="task-group"
                                        value={draft.groupId}
                                        onChange={(e) => set({ groupId: e.target.value })}
                                        options={[{ value: '', label: '—' }, ...options.groups.map((group) => ({ value: String(group.id), label: group.name }))]}
                                    />
                                </Field>
                            )}
                            <Field label={form.estimate} htmlFor="task-estimate">
                                <div className="w-32">
                                    <Input id="task-estimate" type="number" min={1} value={draft.estimate} onChange={(e) => set({ estimate: e.target.value })} />
                                </div>
                            </Field>
                        </div>
                    </FormCard>

                    <FormCard title={form.sections.how} icon={BookOpen} hint={copy.guides.passwordsHint}>
                        <Field label={form.notes} htmlFor="task-notes">
                            <MarkdownField id="task-notes" value={draft.notes} onChange={(notes) => set({ notes })} placeholder={form.notesPlaceholder} />
                        </Field>
                        <Field label={form.checklist}>
                            <p className="-mt-1 mb-2 text-xs text-fg-subtle">{form.checklistHint}</p>
                            <ChecklistEditor items={draft.checklist} onChange={(checklist) => set({ checklist })} />
                        </Field>
                        <Field label={form.guides}>
                            <MultiPick options={guideOptions} selected={draft.guideIds} onChange={(guideIds) => set({ guideIds })} emptyText={form.noGuides} />
                        </Field>
                    </FormCard>

                    <FormCard title={form.sections.where} icon={Link2} hint={copy.pathHint}>
                        <Field label={form.links}>
                            <LinksEditor links={draft.links} onChange={(links) => set({ links })} />
                        </Field>
                        <Field label={form.contacts}>
                            <MultiPick options={contactOptions} selected={draft.contactIds} onChange={(contactIds) => set({ contactIds })} emptyText={form.noContacts} />
                        </Field>
                    </FormCard>
                </Fragment>,
            ]}
        />
    );
}
