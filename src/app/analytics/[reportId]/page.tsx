import { notFound } from 'next/navigation';
import { Header } from '@/components/Header';
import { AnalyticsSidebar } from '@/components/analytics/AnalyticsSidebar';
import { ANALYTICS_SECTIONS, REPORT_COMPONENTS } from '@/config/analyticsSections';
import { BarChart3 } from 'lucide-react';
import { APP_COPY } from '@/locales/en';

interface AnalyticsReportPageProps {
    params: Promise<{
        reportId: string;
    }>;
}

export default async function AnalyticsReportPage({ params }: AnalyticsReportPageProps) {
    const { reportId } = await params;

    // Validate report exists
    const activeSectionConfig = ANALYTICS_SECTIONS.find(s => s.id === reportId);
    const ReportComponent = REPORT_COMPONENTS[reportId];

    if (!activeSectionConfig || !ReportComponent) {
        notFound();
    }

    return (
        <div className="h-screen flex flex-col bg-background overflow-hidden">
            <Header />
            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar */}
                <AnalyticsSidebar activeSection={reportId} />

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
                            <div className="flex items-center gap-2 text-zinc-400">
                                <span className="text-sm font-medium">{activeSectionConfig.label}</span>
                                {activeSectionConfig.description && (
                                    <>
                                        <span className="text-zinc-600">•</span>
                                        <span className="text-sm text-zinc-500">
                                            {activeSectionConfig.description}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Active Report Component */}
                        <div>
                            <ReportComponent />
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}

// Generate static params for all reports (optional, for build optimization)
export function generateStaticParams() {
    return ANALYTICS_SECTIONS.map((section) => ({
        reportId: section.id,
    }));
}
