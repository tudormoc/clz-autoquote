import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard';
import { Header } from '@/components/Header';

export default function AnalyticsPage() {
    return (
        <main className="min-h-screen bg-background">
            <Header />
            <AnalyticsDashboard />
        </main>
    );
}
