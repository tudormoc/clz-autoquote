'use client';

import { useMemo, useState } from 'react';
import { CalendarCheck, Plus, Repeat } from 'lucide-react';
import { quickAddAction } from '@/app/tasks/agenda-actions';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getTodayDate } from '@/lib/dateUtils';
import { notify } from '@/lib/notify';
import { describeRepeat, formatShortDay } from '@/lib/tasks/describe';
import { parseQuickEntry } from '@/lib/tasks/quickParse';
import { APP_COPY, fmt } from '@/locales';
import { surfaceClasses } from '@/components/ui/Surface';

const copy = APP_COPY.tasks;

/**
 * One line + Enter, so a thought is never lost. Date words in it are understood ("venerdì alle 10", "il 25",
 * "ogni lunedì"): a preview under the field shows what will be saved; without them it goes to "Senza data".
 */
export function QuickAdd({ onAdded }: { onAdded: () => Promise<void> }) {
    const [line, setLine] = useState('');
    const [saving, setSaving] = useState(false);
    const entry = useMemo(() => parseQuickEntry(line, getTodayDate()), [line]);
    const understood = entry.dueDate !== null || entry.repeat !== null;

    const submit = async () => {
        if (!entry.title) return;
        setSaving(true);
        try {
            const result = await quickAddAction(entry.title, entry.dueDate, entry.dueTime, entry.repeat);
            if (!result.success) {
                notify.error(result.error);
                return;
            }
            notify.success(entry.dueDate ? fmt(copy.quickAddedOn, { title: entry.title, date: formatShortDay(entry.dueDate) }) : fmt(copy.quickAdded, { title: entry.title }));
            setLine('');
            await onAdded();
        } catch (err) {
            notify.failure(err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <form
            className="relative flex gap-2"
            onSubmit={(event) => {
                event.preventDefault();
                submit();
            }}
        >
            <Input value={line} onChange={(e) => setLine(e.target.value)} placeholder={copy.quickAdd} aria-label={copy.quickAdd} disabled={saving} maxLength={200} />
            <Button type="submit" variant="secondary" disabled={saving || !entry.title}>
                <Plus size={16} />
                <span className="hidden sm:inline">{copy.quickAddButton}</span>
            </Button>
            {understood && (
                <p
                    role="status"
                    className={surfaceClasses('floating', 'absolute left-0 top-full z-10 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md px-2.5 py-1.5 text-xs text-fg-secondary')}
                >
                    <span className="text-fg-subtle">{copy.quickPreview}</span>
                    <span className="font-medium text-fg-strong">{entry.title}</span>
                    {entry.dueDate && (
                        <span className="inline-flex items-center gap-1 text-primary">
                            <CalendarCheck size={12} />
                            <span className="font-mono">
                                {formatShortDay(entry.dueDate)}
                                {entry.dueTime && ` ${entry.dueTime}`}
                            </span>
                        </span>
                    )}
                    {entry.repeat && (
                        <span className="inline-flex items-center gap-1 text-info-300">
                            <Repeat size={12} />
                            {describeRepeat(entry.repeat)}
                        </span>
                    )}
                </p>
            )}
        </form>
    );
}
