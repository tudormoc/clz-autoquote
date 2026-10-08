import { CalendarDays } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { MonthlyHoursTable } from '@/components/presence/MonthlyHoursTable';
import { APP_COPY } from '@/locales';

export const metadata = { title: APP_COPY.analytics.monthlySummary.title };

/**
 * Monthly Presence Summary Dashboard
 * For calculating and managing operator hours, missing hours, holidays, sickness, etc.
 */
export default function MonthlySummaryPage() {
    const copy = APP_COPY.analytics.monthlySummary;

    return (
        <>
            <PageHeader icon={CalendarDays} title={copy.title} subtitle={copy.subtitle} />
            <MonthlyHoursTable />
        </>
    );
}
