import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard';
import { Header } from '@/components/Header';

export default function AnalyticsPage() {
    return (
        <div className="h-screen flex flex-col bg-background overflow-hidden">
            <Header />
            <div className="flex-1 overflow-y-auto">
                <AnalyticsDashboard />
            </div>
        </div>
    );
}
