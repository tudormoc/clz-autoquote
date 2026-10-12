'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { quickAddAction } from '@/app/tasks/agenda-actions';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { notify } from '@/lib/notify';
import { APP_COPY, fmt } from '@/locales';

const copy = APP_COPY.tasks;

/** One line + Enter: a task without a date for later, so a thought is never lost */
export function QuickAdd({ onAdded }: { onAdded: () => Promise<void> }) {
    const [title, setTitle] = useState('');
    const [saving, setSaving] = useState(false);

    const submit = async () => {
        const clean = title.trim();
        if (!clean) return;
        setSaving(true);
        try {
            const result = await quickAddAction(clean);
            if (!result.success) {
                notify.error(result.error);
                return;
            }
            notify.success(fmt(copy.quickAdded, { title: clean }));
            setTitle('');
            await onAdded();
        } catch (err) {
            notify.failure(err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <form
            className="flex gap-2"
            onSubmit={(event) => {
                event.preventDefault();
                submit();
            }}
        >
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={copy.quickAdd} aria-label={copy.quickAdd} disabled={saving} maxLength={200} />
            <Button type="submit" variant="secondary" disabled={saving || !title.trim()}>
                <Plus size={16} />
                <span className="hidden sm:inline">{copy.quickAddButton}</span>
            </Button>
        </form>
    );
}
