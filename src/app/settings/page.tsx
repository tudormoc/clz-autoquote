import AdminDashboard from '@/components/admin/AdminDashboard';
import { AppShell } from '@/components/layout/AppShell';

export default function AdminPage() {
    return (
        <AppShell layout="bare">
            <AdminDashboard />
        </AppShell>
    );
}
