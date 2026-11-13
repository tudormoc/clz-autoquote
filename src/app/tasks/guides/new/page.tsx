import { BookOpen } from '@/components/ui/icons';
import { FillPage } from '@/components/layout/FillPage';
import { PageHeader } from '@/components/layout/PageHeader';
import { GuideForm } from '@/components/tasks/guides/GuideForm';
import { requirePage } from '@/lib/auth/access';
import { APP_COPY } from '@/locales';

const title = APP_COPY.tasks.guides.newTitle;

export const metadata = { title };

export default async function NewGuidePage() {
    await requirePage('tasks', 'guides');
    return (
        <FillPage header={<PageHeader icon={BookOpen} title={title} />}>
            <GuideForm id={null} />
        </FillPage>
    );
}
