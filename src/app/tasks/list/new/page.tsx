import { ListChecks } from 'lucide-react';
import { FillPage } from '@/components/layout/FillPage';
import { PageHeader } from '@/components/layout/PageHeader';
import { TaskForm } from '@/components/tasks/form/TaskForm';
import { requirePage } from '@/lib/auth/access';
import { APP_COPY } from '@/locales';

const form = APP_COPY.tasks.form;

export const metadata = { title: form.newTitle };

interface NewTaskPageProps {
    /** ?copy=12: start from a copy of task 12 ("Duplica") */
    searchParams: Promise<{ copy?: string }>;
}

export default async function NewTaskPage({ searchParams }: NewTaskPageProps) {
    await requirePage('tasks', 'list');
    const copyFrom = Number((await searchParams).copy);
    return (
        <FillPage header={<PageHeader icon={ListChecks} title={form.newTitle} />}>
            <TaskForm id={null} copyFrom={Number.isInteger(copyFrom) && copyFrom > 0 ? copyFrom : null} />
        </FillPage>
    );
}
