import { BarChart3 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { APP_COPY } from '@/locales';

export default function AnalyticsPage() {
    const copy = APP_COPY.analytics;

    return (
        <>
            <PageHeader icon={BarChart3} title={copy.title} subtitle={copy.subtitle} />
            <EmptyState title={`${copy.sidebar.title}: ${copy.sidebar.allReports}`} description={copy.subtitle} />
        </>
    );
}
