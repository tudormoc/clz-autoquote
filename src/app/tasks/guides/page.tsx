import { BookOpen } from 'lucide-react';
import { FillPage } from '@/components/layout/FillPage';
import { PageHeader } from '@/components/layout/PageHeader';
import { GuidesListView } from '@/components/tasks/guides/GuidesListView';
import { AgendaSearch } from '@/components/tasks/shared/AgendaSearch';
import { requirePage } from '@/lib/auth/access';
import { APP_COPY } from '@/locales';

const page = APP_COPY.tasks.pages.guides;

export const metadata = { title: page.label };

export default async function GuidesPage() {
    await requirePage('tasks', 'guides');
    return (
        <FillPage header={<PageHeader icon={BookOpen} title={page.label} subtitle={page.description} actions={<AgendaSearch />} />}>
            <GuidesListView />
        </FillPage>
    );
}
