import { ListChecks } from '@/components/ui/icons';
import { FillPage } from '@/components/layout/FillPage';
import { PageHeader } from '@/components/layout/PageHeader';
import { TaskListView } from '@/components/tasks/list/TaskListView';
import { AgendaSearch } from '@/components/tasks/shared/AgendaSearch';
import { NewTaskButton } from '@/components/tasks/shared/NewTaskButton';
import { requirePage } from '@/lib/auth/access';
import { APP_COPY } from '@/locales';

const page = APP_COPY.tasks.pages.list;

export const metadata = { title: page.label };

export default async function TaskListPage() {
    await requirePage('tasks', 'list');
    return (
        <FillPage header={<PageHeader icon={ListChecks} title={page.label} actions={
                        <>
                            <AgendaSearch />
                            <NewTaskButton />
                        </>
                    } />}>
            <TaskListView />
        </FillPage>
    );
}
