import { Users } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { OperatorsTable } from '@/components/presence/OperatorsTable';
import { APP_COPY } from '@/locales';

export default function OperatorsPage() {
    const copy = APP_COPY.analytics.operators;

    return (
        <>
            <PageHeader icon={Users} title={copy.title} subtitle={copy.subtitle} />
            <OperatorsTable />
        </>
    );
}
