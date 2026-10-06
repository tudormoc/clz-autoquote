import { Calendar } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { DailyEventsTable } from '@/components/presence/DailyEventsTable';
import { APP_COPY } from '@/locales';

export default function DailyEventsPage() {
    const copy = APP_COPY.analytics.dailyEvents;

    return (
        <>
            <PageHeader icon={Calendar} title={copy.title} subtitle={copy.subtitle} />
            <DailyEventsTable />
        </>
    );
}
