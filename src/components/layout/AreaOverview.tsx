import { NavCards } from '@/components/layout/NavCards';
import { PageHeader } from '@/components/layout/PageHeader';
import { getNavArea, type NavAreaId } from '@/config/navigation';

/** Overview page of an area (/analytics, /presence, /settings): its title, then a card for each of its pages. */
export function AreaOverview({ areaId }: { areaId: NavAreaId }) {
    const area = getNavArea(areaId);

    return (
        <>
            <PageHeader icon={area.icon} title={area.label} subtitle={area.description} />
            <NavCards groups={area.groups ?? []} />
        </>
    );
}
