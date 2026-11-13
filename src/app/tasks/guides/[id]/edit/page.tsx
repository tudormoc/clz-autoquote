import { notFound } from 'next/navigation';
import { BookOpen } from '@/components/ui/icons';
import { FillPage } from '@/components/layout/FillPage';
import { PageHeader } from '@/components/layout/PageHeader';
import { GuideForm } from '@/components/tasks/guides/GuideForm';
import { requirePage } from '@/lib/auth/access';
import { APP_COPY } from '@/locales';

const title = APP_COPY.tasks.guides.editTitle;

export const metadata = { title };

export default async function EditGuidePage({ params }: { params: Promise<{ id: string }> }) {
    await requirePage('tasks', 'guides');
    const id = Number((await params).id);
    if (!Number.isInteger(id) || id <= 0) notFound();
    return (
        <FillPage header={<PageHeader icon={BookOpen} title={title} />}>
            <GuideForm id={id} />
        </FillPage>
    );
}
