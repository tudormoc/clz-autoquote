import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { ANALYTICS_SECTIONS, getAnalyticsSection } from '@/config/analyticsSections';
import { REPORT_COMPONENTS } from '@/components/analytics/reportComponents';

interface AnalyticsReportPageProps {
    params: Promise<{
        reportId: string;
    }>;
}

export default async function AnalyticsReportPage({ params }: AnalyticsReportPageProps) {
    const { reportId } = await params;

    const section = getAnalyticsSection(reportId);
    const ReportComponent = REPORT_COMPONENTS[reportId];

    if (!section || !ReportComponent) {
        notFound();
    }

    return (
        <>
            <PageHeader icon={section.icon} title={section.label} subtitle={section.description} />
            <ReportComponent />
        </>
    );
}

export async function generateMetadata({ params }: AnalyticsReportPageProps) {
    const { reportId } = await params;
    return { title: getAnalyticsSection(reportId)?.label };
}

// Pre-render every report route at build time
export function generateStaticParams() {
    return ANALYTICS_SECTIONS.map((section) => ({
        reportId: section.id,
    }));
}
