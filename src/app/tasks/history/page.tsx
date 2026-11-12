import { History } from 'lucide-react';
import { FillPage } from '@/components/layout/FillPage';
import { PageHeader } from '@/components/layout/PageHeader';
import { HistoryView } from '@/components/tasks/history/HistoryView';
import { AgendaSearch } from '@/components/tasks/shared/AgendaSearch';
import { requirePage } from '@/lib/auth/access';
import { APP_COPY } from '@/locales';

const page = APP_COPY.tasks.pages.history;

export const metadata = { title: page.label };

export default async function HistoryPage() {
    await requirePage('tasks', 'history');
    return (
        <FillPage header={<PageHeader icon={History} title={page.label} actions={<AgendaSearch />} />}>
            <HistoryView />
        </FillPage>
    );
}
