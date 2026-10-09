import { CashflowDashboard } from '@/components/cashflow/CashflowDashboard';
import { getNavArea } from '@/config/navigation';
import { requirePage } from '@/lib/auth/access';

export const metadata = { title: getNavArea('cashflow').label };

export default async function CashflowPage() {
    await requirePage('cashflow');
    return <CashflowDashboard />;
}
