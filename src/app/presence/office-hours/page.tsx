import { ClipboardList } from '@/components/ui/icons';
import { FillPage } from '@/components/layout/FillPage';
import { PageHeader } from '@/components/layout/PageHeader';
import { OfficeHoursView } from '@/components/timesheet/OfficeHoursView';
import { requirePage } from '@/lib/auth/access';
import { APP_COPY } from '@/locales';

const page = APP_COPY.timesheet.pages.officeHours;

export const metadata = { title: page.label };

/** Ore Ufficio: everyone's hours of a month, to check, correct and export for the pay studio (docs/TIMESHEET.md) */
export default async function OfficeHoursPage() {
    await requirePage('presence', 'office-hours');
    return (
        <FillPage header={<PageHeader icon={ClipboardList} title={page.label} />}>
            <OfficeHoursView />
        </FillPage>
    );
}
