import { notFound } from 'next/navigation';
import { TaskView } from '@/components/tasks/task/TaskView';
import { requirePage } from '@/lib/auth/access';
import { APP_COPY } from '@/locales';

export const metadata = { title: APP_COPY.tasks.pages.list.label };

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
    await requirePage('tasks', 'list');
    const id = Number((await params).id);
    if (!Number.isInteger(id) || id <= 0) notFound();
    return <TaskView id={id} />;
}
