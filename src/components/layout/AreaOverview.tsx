import { NavCards } from '@/components/layout/NavCards';
import { PageHeader } from '@/components/layout/PageHeader';
import { getNavArea, type NavAreaId } from '@/config/navigation';
import { requirePage } from '@/lib/auth/access';
import { visibleAreas } from '@/lib/auth/permissions';

/** Overview page of an area (/analytics, /presence, /settings): its title, then a card for each page the person may open. */
export async function AreaOverview({ areaId }: { areaId: NavAreaId }) {
    const access = await requirePage(areaId);
    const area = getNavArea(areaId);
    const groups = visibleAreas(access).find((visible) => visible.id === areaId)?.groups ?? [];

    return (
        <>
            <PageHeader icon={area.icon} title={area.label} />
            <NavCards groups={groups} />
        </>
    );
}
