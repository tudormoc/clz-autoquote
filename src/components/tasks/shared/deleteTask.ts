'use client';

import { deleteTaskAction } from '@/app/tasks/task-actions';
import { confirmDelete } from '@/lib/confirm';
import { notify } from '@/lib/notify';
import { APP_COPY, fmt } from '@/locales';

const copy = APP_COPY.tasks;

/** Asks first ("Elimina"), then deletes the task for good with all its dates and history; true when deleted */
export async function confirmAndDeleteTask(task: { id: number; title: string }): Promise<boolean> {
    if (!(await confirmDelete(fmt(copy.dialogs.deleteConfirm, { title: task.title })))) return false;
    try {
        const result = await deleteTaskAction(task.id);
        if (!result.success) {
            notify.error(result.error);
            return false;
        }
        notify.success(fmt(copy.messages.deleted, { title: task.title }));
        return true;
    } catch (err) {
        notify.failure(err);
        return false;
    }
}
