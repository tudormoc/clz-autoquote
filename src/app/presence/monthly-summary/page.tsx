import { CalendarDays } from 'lucide-react';
import { FillPage } from '@/components/layout/FillPage';
import { PageHeader } from '@/components/layout/PageHeader';
import { MonthlyHoursTable } from '@/components/presence/MonthlyHoursTable';
import { APP_COPY } from '@/locales';
import { requirePage } from '@/lib/auth/access';

export const metadata = { title: APP_COPY.analytics.monthlySummary.title };

/**
 * Monthly Presence Summary Dashboard
 * For calculating and managing operator hours, missing hours, holidays, sickness, etc.
 */
export default async function MonthlySummaryPage() {
    await requirePage('presence', 'monthly-summary');
    const copy = APP_COPY.analytics.monthlySummary;

    return (
        <FillPage header={<PageHeader icon={CalendarDays} title={copy.title} />}>
            <MonthlyHoursTable />
        </FillPage>
    );
}
