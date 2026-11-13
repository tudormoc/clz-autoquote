import { notFound } from 'next/navigation';
import { ListChecks } from '@/components/ui/icons';
import { FillPage } from '@/components/layout/FillPage';
import { PageHeader } from '@/components/layout/PageHeader';
import { TaskForm } from '@/components/tasks/form/TaskForm';
import { requirePage } from '@/lib/auth/access';
import { APP_COPY } from '@/locales';

const form = APP_COPY.tasks.form;

export const metadata = { title: form.editTitle };

export default async function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
    await requirePage('tasks', 'list');
    const id = Number((await params).id);
    if (!Number.isInteger(id) || id <= 0) notFound();
    return (
        <FillPage header={<PageHeader icon={ListChecks} title={form.editTitle} />}>
            <TaskForm id={id} copyFrom={null} />
        </FillPage>
    );
}
