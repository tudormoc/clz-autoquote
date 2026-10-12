import { notFound } from 'next/navigation';
import { GuideView } from '@/components/tasks/guides/GuideView';
import { requirePage } from '@/lib/auth/access';
import { APP_COPY } from '@/locales';

export const metadata = { title: APP_COPY.tasks.pages.guides.label };

export default async function GuidePage({ params }: { params: Promise<{ id: string }> }) {
    await requirePage('tasks', 'guides');
    const id = Number((await params).id);
    if (!Number.isInteger(id) || id <= 0) notFound();
    return <GuideView id={id} />;
}
