import { AreaOverview } from '@/components/layout/AreaOverview';
import { getNavArea } from '@/config/navigation';

export const metadata = { title: getNavArea('analytics').label };

export default function AnalyticsPage() {
    return <AreaOverview areaId="analytics" />;
}
