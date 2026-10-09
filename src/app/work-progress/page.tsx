import { OrderOperationsReport } from '@/components/analytics/OrderOperationsReport';
import { getNavArea } from '@/config/navigation';
import { requirePage } from '@/lib/auth/access';

export const metadata = { title: getNavArea('work-progress').label };

export default async function WorkProgressPage() {
    await requirePage('work-progress');
    // Fills the height: only the active panel scrolls, never the page
    return (
        <div className="h-full flex flex-col">
            <OrderOperationsReport />
        </div>
    );
}
