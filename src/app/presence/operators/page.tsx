import { Users } from 'lucide-react';
import { FillPage } from '@/components/layout/FillPage';
import { PageHeader } from '@/components/layout/PageHeader';
import { OperatorsTable } from '@/components/presence/OperatorsTable';
import { APP_COPY } from '@/locales';

export const metadata = { title: APP_COPY.analytics.operators.title };

export default function OperatorsPage() {
    const copy = APP_COPY.analytics.operators;

    return (
        <FillPage header={<PageHeader icon={Users} title={copy.title} subtitle={copy.subtitle} />}>
            <OperatorsTable />
        </FillPage>
    );
}
