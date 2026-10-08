import { Calendar } from 'lucide-react';
import { FillPage } from '@/components/layout/FillPage';
import { PageHeader } from '@/components/layout/PageHeader';
import { DailyEventsTable } from '@/components/presence/DailyEventsTable';
import { APP_COPY } from '@/locales';

export const metadata = { title: APP_COPY.analytics.dailyEvents.title };

export default function DailyEventsPage() {
    const copy = APP_COPY.analytics.dailyEvents;

    return (
        <FillPage header={<PageHeader icon={Calendar} title={copy.title} subtitle={copy.subtitle} />}>
            <DailyEventsTable />
        </FillPage>
    );
}
