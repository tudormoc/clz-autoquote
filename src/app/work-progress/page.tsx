import { AppShell } from '@/components/layout/AppShell';
import { OrderOperationsReport } from '@/components/analytics/OrderOperationsReport';

export default function WorkProgressPage() {
    // Full-height workspace: only the active panel scrolls, never the page
    return (
        <AppShell layout="workspace">
            <OrderOperationsReport />
        </AppShell>
    );
}
