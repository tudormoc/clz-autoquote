'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { APP_COPY } from '@/locales';
import { cn } from '@/lib/utils';

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
            <button
                type="button"
                onClick={() => setWriting(true)}
                className={cn(
                    'w-full flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-fg-subtle hover:text-primary hover:bg-primary/5 transition-colors focus-visible:opacity-100',
                    quiet && 'md:opacity-0 md:group-hover/day:opacity-100'
                )}
            >
                <Plus size={13} />
                {copy.add}
            </button>
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
                className="w-full rounded-md border border-primary/60 bg-background px-2 py-1.5 text-sm text-fg placeholder:text-fg-faint focus-visible:outline-none"
            />
        </form>
    );
}
