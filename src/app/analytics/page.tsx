import { Header } from '@/components/Header';
import { AnalyticsSidebar } from '@/components/analytics/AnalyticsSidebar';
import { BarChart3 } from 'lucide-react';
import { APP_COPY } from '@/locales';

export default function AnalyticsPage() {
    return (
        <div className="h-screen flex flex-col bg-background overflow-hidden">
            <Header />
            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar */}
                <AnalyticsSidebar activeSection="" />

                {/* Main Content */}
                <main className="flex-1 bg-background overflow-y-auto">
                    <div className="max-w-screen-2xl mx-auto px-6 py-6">
                        {/* Header */}
                        <div className="mb-6">
                            <div className="flex items-center gap-3 mb-2">
                                <BarChart3 className="text-primary" size={24} />
                                <h1 className="text-2xl font-bold text-white">
                                    {APP_COPY.analytics.title}
                                </h1>
                            </div>
                            <p className="text-zinc-400">
                                {APP_COPY.analytics.subtitle}
                            </p>
                        </div>

                        {/* Welcome Message */}
                        <div className="bg-card border border-zinc-800 rounded-lg p-8 text-center">
                            <p className="text-zinc-300 text-lg mb-2">
                                {APP_COPY.analytics.sidebar.title}: {APP_COPY.analytics.sidebar.allReports}
                            </p>
                            <p className="text-zinc-500 text-sm">
                                {APP_COPY.analytics.subtitle}
                            </p>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
