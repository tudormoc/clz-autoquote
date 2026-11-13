'use client';

import { useState } from 'react';
import { Plus } from '@/components/ui/icons';
import { APP_COPY } from '@/locales';
import { cn } from '@/lib/utils';
import { TextButton } from '@/components/ui/TextButton';
import { FIELD } from '@/components/ui/fieldLook';

const copy = APP_COPY.tasks.calendar;

interface DayQuickAddProps {
    /** Saves a task with this title on the day; true when added */
    onAdd: (title: string) => Promise<boolean>;
    /** Shown only on hover of the day (desktop); always on phones */
    quiet: boolean;
}

/** "+ Aggiungi" at the foot of a day: turns into a line; Enter adds a task on that day, Escape gives up */
export function DayQuickAdd({ onAdd, quiet }: DayQuickAddProps) {
    const [writing, setWriting] = useState(false);
    const [title, setTitle] = useState('');
    const [saving, setSaving] = useState(false);

    if (!writing) {
        return (
            <TextButton
                onClick={() => setWriting(true)}
                className={cn('w-full gap-1.5 px-2 py-1.5 text-xs focus-visible:opacity-100', quiet && 'md:opacity-0 md:group-hover/day:opacity-100')}
            >
                <Plus size={13} />
                {copy.add}
            </TextButton>
        );
    }

    const close = () => {
        setWriting(false);
        setTitle('');
    };

    return (
        <form
            onSubmit={async (event) => {
                event.preventDefault();
                if (!title.trim()) return close();
                setSaving(true);
                if (await onAdd(title.trim())) close();
                setSaving(false);
            }}
        >
            <input
                autoFocus
                value={title}
                disabled={saving}
                maxLength={200}
                onChange={(event) => setTitle(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === 'Escape') close();
                }}
                onBlur={() => {
                    if (!title.trim()) close();
                }}
                placeholder={copy.addPlaceholder}
                aria-label={copy.add}
                className={cn(FIELD, 'px-2 py-1.5')}
            />
        </form>
    );
}
