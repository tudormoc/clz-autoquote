import { AreaOverview } from '@/components/layout/AreaOverview';
import { getNavArea } from '@/config/navigation';

export const metadata = { title: getNavArea('settings').label };

export default function SettingsPage() {
    return <AreaOverview areaId="settings" />;
}
