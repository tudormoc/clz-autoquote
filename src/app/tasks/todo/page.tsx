import { ListTodo } from 'lucide-react';
import { FillPage } from '@/components/layout/FillPage';
import { PageHeader } from '@/components/layout/PageHeader';
import { TodoView } from '@/components/tasks/agenda/TodoView';
import { AgendaSearch } from '@/components/tasks/shared/AgendaSearch';
import { NewTaskButton } from '@/components/tasks/shared/NewTaskButton';
import { requirePage } from '@/lib/auth/access';
import { APP_COPY } from '@/locales';

const page = APP_COPY.tasks.pages.todo;

export const metadata = { title: page.label };

export default async function TodoPage() {
    await requirePage('tasks', 'todo');
    return (
        <FillPage header={<PageHeader icon={ListTodo} title={page.label} actions={
                        <>
                            <AgendaSearch />
                            <NewTaskButton />
                        </>
                    } />}>
            <TodoView />
        </FillPage>
    );
}
