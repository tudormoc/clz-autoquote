import { notFound } from 'next/navigation';
import { FillPage } from '@/components/layout/FillPage';
import { PageHeader } from '@/components/layout/PageHeader';
import { getAnalyticsSection } from '@/config/analyticsSections';
import { requirePage } from '@/lib/auth/access';
import { REPORT_COMPONENTS } from '@/components/analytics/reportComponents';

interface AnalyticsReportPageProps {
    params: Promise<{
        reportId: string;
    }>;
}

export default async function AnalyticsReportPage({ params }: AnalyticsReportPageProps) {
    const { reportId } = await params;
    await requirePage('analytics', reportId);

    const section = getAnalyticsSection(reportId);
    if (!section) notFound();
    const ReportComponent = REPORT_COMPONENTS[section.id];

    return (
        <FillPage header={<PageHeader icon={section.icon} title={section.label} />}>
            <ReportComponent />
        </FillPage>
    );
}

export async function generateMetadata({ params }: AnalyticsReportPageProps) {
    const { reportId } = await params;
    return { title: getAnalyticsSection(reportId)?.label };
}
