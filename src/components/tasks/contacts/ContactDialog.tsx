'use client';

import { useId, useState } from 'react';
import { UserRound } from 'lucide-react';
import { saveContactAction } from '@/app/tasks/guide-actions';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { notify } from '@/lib/notify';
import { ContactInputSchema, inputProblem, type ContactInput } from '@/lib/tasks/input';
import type { Contact } from '@/lib/tasks/types';
import { APP_COPY } from '@/locales';

const copy = APP_COPY.tasks.contacts;

interface ContactDialogProps {
    /** null = a new contact */
    contact: Contact | null;
    onSaved: () => Promise<void>;
    onClose: () => void;
}

/** "Nuovo contatto" / "Modifica contatto": name, company, role, phone, email, notes */
export function ContactDialog({ contact, onSaved, onClose }: ContactDialogProps) {
    const formId = useId();
    const [draft, setDraft] = useState<ContactInput>({
        name: contact?.name ?? '',
        company: contact?.company ?? '',
        role: contact?.role ?? '',
        phone: contact?.phone ?? '',
        email: contact?.email ?? '',
        notes: contact?.notes ?? '',
    });
    const [saving, setSaving] = useState(false);
    const set = (change: Partial<ContactInput>) => setDraft({ ...draft, ...change });

    const save = async () => {
        const input = { ...draft, name: draft.name.trim(), company: draft.company.trim(), role: draft.role.trim(), phone: draft.phone.trim(), email: draft.email.trim() };
        const problem = inputProblem(ContactInputSchema, input);
        if (problem) {
            notify.error(problem);
            return;
        }
        setSaving(true);
        try {
            const result = await saveContactAction(contact?.id ?? null, input, contact?.version ?? null);
            if (!result.success) {
                notify.error(result.error);
                return;
            }
            notify.success(APP_COPY.tasks.messages.saved);
            await onSaved();
            onClose();
        } catch (err) {
            notify.failure(err);
        } finally {
            setSaving(false);
        }
    };

    const field = (key: keyof ContactInput, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
        <Field label={label} htmlFor={`${formId}-${key}`}>
            <Input id={`${formId}-${key}`} value={draft[key]} onChange={(e) => set({ [key]: e.target.value })} {...extra} />
        </Field>
    );

    return (
        <Modal
            title={contact ? copy.editTitle : copy.newTitle}
            icon={UserRound}
            size="lg"
            onClose={onClose}
            busy={saving}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={saving}>
                        {APP_COPY.common.cancel}
                    </Button>
                    <Button type="submit" form={formId} disabled={saving}>
                        {APP_COPY.common.save}
                    </Button>
                </>
            }
        >
            <form
                id={formId}
                className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                onSubmit={(event) => {
                    event.preventDefault();
                    save();
                }}
            >
                {field('name', copy.name, { placeholder: copy.namePlaceholder, autoFocus: true, maxLength: 150 })}
                {field('company', copy.company, { maxLength: 150 })}
                {field('role', copy.role, { placeholder: copy.rolePlaceholder, maxLength: 150 })}
                {field('phone', copy.phone, { type: 'tel', maxLength: 50 })}
                <div className="sm:col-span-2">{field('email', copy.email, { type: 'email', maxLength: 200 })}</div>
                <div className="sm:col-span-2">
                    <Field label={copy.notes} htmlFor={`${formId}-notes`}>
                        <Textarea id={`${formId}-notes`} rows={3} value={draft.notes} onChange={(e) => set({ notes: e.target.value })} />
                    </Field>
                </div>
            </form>
        </Modal>
    );
}
