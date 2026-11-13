'use client';

import { useState } from 'react';
import { Pencil, Save } from '@/components/ui/icons';
import { saveTaskNotesAction } from '@/app/tasks/task-actions';
import { useCanEdit } from '@/components/auth/AccessProvider';
import { Button } from '@/components/ui/Button';
import { Markdown } from '@/components/ui/Markdown';
import { MarkdownField } from '@/components/ui/MarkdownField';
import { notify } from '@/lib/notify';
import { APP_COPY } from '@/locales';
import { titleClasses } from '@/components/ui/titleLook';

const copy = APP_COPY.tasks;

interface QuickNotesProps {
    taskId: number;
    version: string;
    notes: string;
    /** Called after a save, to read the task again */
    onSaved: () => Promise<void>;
    /** Shown under the text (linked procedures) */
    children?: React.ReactNode;
}

/** "Come si fa" with a pencil: write or change the instructions right here, without opening the whole form */
export function QuickNotes({ taskId, version, notes, onSaved, children }: QuickNotesProps) {
    const canEdit = useCanEdit();
    const [draft, setDraft] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const save = async () => {
        if (draft === null) return;
        setSaving(true);
        try {
            const result = await saveTaskNotesAction(taskId, version, draft);
            if (!result.success) {
                notify.error(result.error);
                return;
            }
            notify.success(copy.messages.saved);
            setDraft(null);
            await onSaved();
        } catch (err) {
            notify.failure(err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
                <h3 className={titleClasses('label')}>{copy.form.sections.how}</h3>
                {canEdit && draft === null && (
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setDraft(notes)}>
                        <Pencil size={13} />
                        {notes.trim() ? copy.actions.edit : copy.detail.writeNotes}
                    </Button>
                )}
            </div>
            {draft !== null ? (
                <div className="space-y-2">
                    <MarkdownField value={draft} onChange={setDraft} placeholder={copy.form.notesPlaceholder} rows={8} />
                    <div className="flex justify-end gap-2">
                        <Button variant="secondary" size="sm" onClick={() => setDraft(null)} disabled={saving}>
                            {APP_COPY.common.cancel}
                        </Button>
                        <Button size="sm" onClick={save} disabled={saving || draft === notes}>
                            <Save size={14} />
                            {APP_COPY.common.save}
                        </Button>
                    </div>
                </div>
            ) : notes.trim() ? (
                <Markdown text={notes} />
            ) : (
                <p className="text-sm text-fg-subtle">{canEdit ? copy.detail.notesEmptyHere : copy.detail.notesEmpty}</p>
            )}
            {children}
        </section>
    );
}
