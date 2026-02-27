import AdminDashboard from '@/components/admin/AdminDashboard';
import { Header } from '@/components/Header';

export default function AdminPage() {
    return (
        <div className="h-screen flex flex-col bg-background overflow-hidden">
            <Header />
            <div className="flex-1 overflow-y-auto">
                <AdminDashboard />
            </div>
        </div>
    );
}
