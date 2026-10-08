import { OrderOperationsReport } from '@/components/analytics/OrderOperationsReport';
import { getNavArea } from '@/config/navigation';

export const metadata = { title: getNavArea('work-progress').label };

export default function WorkProgressPage() {
    // Fills the height: only the active panel scrolls, never the page
    return (
        <div className="h-full flex flex-col">
            <OrderOperationsReport />
        </div>
    );
}
