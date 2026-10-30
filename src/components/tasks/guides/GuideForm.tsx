'use client';

import { Fragment } from 'react';
import { BookOpen, Link2 } from 'lucide-react';
import { AgendaForm } from '@/components/tasks/shared/AgendaForm';
import { FormCard } from '@/components/tasks/shared/FormCard';
import { LinksEditor } from '@/components/tasks/shared/LinksEditor';
import { LoadState } from '@/components/ui/LoadState';
import { MultiPick } from '@/components/tasks/shared/MultiPick';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { MarkdownField } from '@/components/ui/MarkdownField';
import { Select } from '@/components/ui/Select';
import { TASK_PAGES } from '@/config/navigation';
import { useGuideForm } from '@/hooks/useGuideForm';
import { APP_COPY } from '@/locales';

const copy = APP_COPY.tasks;
const guides = copy.guides;

/** Create (id null) or change a procedure; every save keeps the earlier text as a version */
export function GuideForm({ id }: { id: number | null }) {
    const { draft, areas, contacts, loading, error, saving, set, save } = useGuideForm(id);
    if (!draft) return <LoadState loading={loading} error={error} />;

    const contactOptions = contacts
        .filter((contact) => contact.state === 'active' || draft.contactIds.includes(contact.id))
        .map((contact) => ({ id: contact.id, label: contact.name, detail: [contact.role, contact.company].filter(Boolean).join(' · ') || undefined }));

    return (
        <AgendaForm
            onSave={save}
            saving={saving}
            cancelHref={id ? `${TASK_PAGES.guides}/${id}` : TASK_PAGES.guides}
            saveLabel={copy.form.save}
            columns={[
                <Fragment key="text">
                    <FormCard title={guides.body} icon={BookOpen} hint={guides.passwordsHint}>
                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_16rem] gap-4">
                            <Field label={guides.title} htmlFor="guide-title">
                                <Input id="guide-title" value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder={guides.titlePlaceholder} maxLength={200} autoFocus={id === null} />
                            </Field>
                            <Field label={copy.form.area} htmlFor="guide-area">
                                <Select
                                    id="guide-area"
                                    value={draft.areaId}
                                    onChange={(e) => set({ areaId: e.target.value })}
                                    options={[{ value: '', label: copy.form.noArea }, ...areas.map((area) => ({ value: String(area.id), label: area.name }))]}
                                />
                            </Field>
                        </div>
                        <MarkdownField value={draft.body} onChange={(body) => set({ body })} placeholder={guides.bodyPlaceholder} rows={16} />
                        <Field label={guides.reviewMonths} htmlFor="guide-review">
                            <div className="w-28">
                                <Input id="guide-review" type="number" min={1} value={draft.reviewMonths} onChange={(e) => set({ reviewMonths: e.target.value })} />
                            </div>
                            <p className="mt-1 text-xs text-fg-subtle">{guides.reviewHint}</p>
                        </Field>
                    </FormCard>
                </Fragment>,
                <Fragment key="where">
                    <FormCard title={copy.form.sections.where} icon={Link2} hint={copy.pathHint}>
                        <Field label={copy.form.links}>
                            <LinksEditor links={draft.links} onChange={(links) => set({ links })} />
                        </Field>
                        <Field label={copy.form.contacts}>
                            <MultiPick options={contactOptions} selected={draft.contactIds} onChange={(contactIds) => set({ contactIds })} emptyText={copy.form.noContacts} />
                        </Field>
                    </FormCard>
                </Fragment>,
            ]}
        />
    );
}
