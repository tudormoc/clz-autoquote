import { AreaOverview } from '@/components/layout/AreaOverview';
import { getNavArea } from '@/config/navigation';

export const metadata = { title: getNavArea('tasks').label };

export default function TasksPage() {
    return <AreaOverview areaId="tasks" />;
}
