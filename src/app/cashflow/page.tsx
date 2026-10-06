import { AppShell } from '@/components/layout/AppShell';
import { CashflowDashboard } from '@/components/cashflow/CashflowDashboard';

export default function CashflowPage() {
    return (
        <AppShell>
            <CashflowDashboard />
        </AppShell>
    );
}
