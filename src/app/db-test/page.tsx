import { Database } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { DatabaseExplorer } from '@/components/database/DatabaseExplorer';
import { APP_COPY } from '@/locales';

const copy = APP_COPY.home.cards.database;

export const metadata = {
    title: `${copy.title} | ${APP_COPY.header.title}`,
    description: copy.description,
};

export default function DBTestPage() {
    return (
        <AppShell>
            <PageHeader icon={Database} title={copy.title} subtitle={copy.description} />
            <DatabaseExplorer />
        </AppShell>
    );
}
