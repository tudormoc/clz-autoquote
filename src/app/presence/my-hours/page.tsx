import { Clock } from 'lucide-react';
import { FillPage } from '@/components/layout/FillPage';
import { PageHeader } from '@/components/layout/PageHeader';
import { MyHoursView } from '@/components/timesheet/MyHoursView';
import { requirePage } from '@/lib/auth/access';
import { APP_COPY } from '@/locales';

const page = APP_COPY.timesheet.pages.myHours;

export const metadata = { title: page.label };

/** Le mie ore: the logged-in person's own hours, day by day (docs/TIMESHEET.md) */
export default async function MyHoursPage() {
    await requirePage('presence', 'my-hours');
    return (
        <FillPage header={<PageHeader icon={Clock} title={page.label} subtitle={page.description} />}>
            <MyHoursView />
        </FillPage>
    );
}
