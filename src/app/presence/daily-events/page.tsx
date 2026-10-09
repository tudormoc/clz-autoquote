import { Calendar } from 'lucide-react';
import { FillPage } from '@/components/layout/FillPage';
import { PageHeader } from '@/components/layout/PageHeader';
import { DailyEventsTable } from '@/components/presence/DailyEventsTable';
import { APP_COPY } from '@/locales';
import { requirePage } from '@/lib/auth/access';

export const metadata = { title: APP_COPY.analytics.dailyEvents.title };

export default async function DailyEventsPage() {
    await requirePage('presence', 'daily-events');
    const copy = APP_COPY.analytics.dailyEvents;

    return (
        <FillPage header={<PageHeader icon={Calendar} title={copy.title} subtitle={copy.subtitle} />}>
            <DailyEventsTable />
        </FillPage>
    );
}
