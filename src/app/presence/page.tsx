import { AreaOverview } from '@/components/layout/AreaOverview';
import { getNavArea } from '@/config/navigation';

export const metadata = { title: getNavArea('presence').label };

export default function PresencePage() {
    return <AreaOverview areaId="presence" />;
}
