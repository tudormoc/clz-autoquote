import { redirect } from 'next/navigation';
import { NavCards } from '@/components/layout/NavCards';
import { PageHeader } from '@/components/layout/PageHeader';
import { AgendaSummary } from '@/components/tasks/AgendaSummary';
import { EmptyState } from '@/components/ui/EmptyState';
import { requireLogin } from '@/lib/auth/access';
import { LINKS } from '@/config/navigation';
import { canOpen, menuPages, visibleAreas } from '@/lib/auth/permissions';
import { APP_COPY } from '@/locales';

export default async function Home() {
    const access = await requireLogin();
    const areas = visibleAreas(access);
    const pages = menuPages(areas);
    if (pages.length === 1) redirect(pages[0].href);

    // The work areas; someone who only has settings pages sees those
    const work = areas.filter((area) => !area.pinnedBottom);
    return (
        <>
            <PageHeader title={APP_COPY.home.welcome} subtitle={APP_COPY.home.subtitle} />
            {canOpen(access, LINKS.tasks.todo) && <AgendaSummary access={access} />}
            {pages.length === 0 ? (
                <EmptyState title={APP_COPY.auth.noPages} />
            ) : (
                <NavCards groups={[{ items: work.length > 0 ? work : areas }]} />
            )}
        </>
    );
}
