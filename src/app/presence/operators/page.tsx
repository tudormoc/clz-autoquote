import { Users } from 'lucide-react';
import { FillPage } from '@/components/layout/FillPage';
import { PageHeader } from '@/components/layout/PageHeader';
import { OperatorsTable } from '@/components/presence/OperatorsTable';
import { APP_COPY } from '@/locales';
import { requirePage } from '@/lib/auth/access';

export const metadata = { title: APP_COPY.analytics.operators.title };

export default async function OperatorsPage() {
    await requirePage('presence', 'operators');
    const copy = APP_COPY.analytics.operators;

    return (
        <FillPage header={<PageHeader icon={Users} title={copy.title} />}>
            <OperatorsTable />
        </FillPage>
    );
}
