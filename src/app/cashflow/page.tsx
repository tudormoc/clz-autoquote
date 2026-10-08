import { CashflowDashboard } from '@/components/cashflow/CashflowDashboard';
import { getNavArea } from '@/config/navigation';

export const metadata = { title: getNavArea('cashflow').label };

export default function CashflowPage() {
    return <CashflowDashboard />;
}
