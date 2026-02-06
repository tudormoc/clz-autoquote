import AdminDashboard from '@/components/admin/AdminDashboard';
import { Header } from '@/components/Header';

export default function AdminPage() {
    return (
        <main className="min-h-screen bg-[#FDFDFB]">
            <Header />
            <AdminDashboard />
        </main>
    );
}
