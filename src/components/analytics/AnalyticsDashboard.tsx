'use client';

import { useState } from 'react';
import { AnalyticsSidebar } from '@/components/analytics/AnalyticsSidebar';
import { ANALYTICS_SECTIONS, REPORT_COMPONENTS } from '@/config/analyticsSections';
import { BarChart3 } from 'lucide-react';
import { APP_COPY } from '@/locales/en';

export default function AnalyticsDashboard() {
    const [activeSection, setActiveSection] = useState(ANALYTICS_SECTIONS[0].id);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    const activeSectionConfig = ANALYTICS_SECTIONS.find(s => s.id === activeSection);
    const ReportComponent = REPORT_COMPONENTS[activeSection];

    return (
        <div className="flex h-full">
            {/* Sidebar */}
            <AnalyticsSidebar
                activeSection={activeSection}
                onSectionSelect={setActiveSection}
                isCollapsed={sidebarCollapsed}
                onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            />

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
                        {activeSectionConfig && (
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
                        )}
                    </div>

                    {/* Active Report Component */}
                    <div>
                        {ReportComponent ? <ReportComponent /> : (
                            <div className="text-center py-12 text-zinc-500">
                                {APP_COPY.analytics.noReport}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
