'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getTaskFormAction, saveTaskAction } from '@/app/tasks/task-actions';
import { useActionData } from '@/hooks/useActionData';
import { TASK_PAGES } from '@/config/navigation';
import { notify } from '@/lib/notify';
import { emptyTaskDraft, taskDraftFrom, toTaskInput, type RepeatDraft, type TaskDraft } from '@/lib/tasks/taskDraft';
import { APP_COPY, fmt } from '@/locales';

const messages = APP_COPY.tasks.messages;

/**
 * The task form: loads the task (to change it, or to copy it for "Duplica") and the choices, holds the fields,
 * saves and opens the task's page.
 */
export function useTaskForm(id: number | null, copyFrom: number | null) {
    const router = useRouter();
    const source = id ?? copyFrom;
    const load = useCallback(() => getTaskFormAction(source), [source]);
    const { data, loading, error } = useActionData(load);
    const [draft, setDraft] = useState<TaskDraft | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!data || draft) return;
        const { task, options } = data;
        if (!task) setDraft(emptyTaskDraft(options.me, options.today));
        else {
            const filled = taskDraftFrom(task, options.today);
            setDraft(id === null ? { ...filled, title: fmt(APP_COPY.tasks.form.copyTitle, { title: task.title }) } : filled);
        }
    }, [data, draft, id]);

    const set = (change: Partial<TaskDraft>) => setDraft((current) => (current ? { ...current, ...change } : current));
    const setRepeat = (change: Partial<RepeatDraft>) => setDraft((current) => (current ? { ...current, repeat: { ...current.repeat, ...change } } : current));

    const save = async () => {
        if (!draft || !data) return;
        const checked = toTaskInput(draft);
        if ('error' in checked) {
            notify.error(checked.error);
            return;
        }
        setSaving(true);
        try {
            const result = await saveTaskAction(id, checked.input, id === null ? null : data.task?.version ?? null);
            if (!result.success) {
                notify.error(result.error);
                return;
            }
            notify.success(id === null ? messages.created : messages.saved);
            router.push(`${TASK_PAGES.list}/${result.id}`);
        } catch (err) {
            notify.failure(err);
        } finally {
            setSaving(false);
        }
    };

    return { draft, options: data?.options ?? null, loading, error, saving, set, setRepeat, save };
}
