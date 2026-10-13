import { Contact } from 'lucide-react';
import { FillPage } from '@/components/layout/FillPage';
import { PageHeader } from '@/components/layout/PageHeader';
import { ContactsView } from '@/components/tasks/contacts/ContactsView';
import { AgendaSearch } from '@/components/tasks/shared/AgendaSearch';
import { APP_CONFIG } from '@/config/constants';
import { requirePage } from '@/lib/auth/access';
import { APP_COPY } from '@/locales';

const page = APP_COPY.tasks.pages.contacts;

export const metadata = { title: page.label };

interface ContactsPageProps {
    /** q: a name to show (a contact picked in the search bar) */
    searchParams: Promise<{ q?: string }>;
}

export default async function ContactsPage({ searchParams }: ContactsPageProps) {
    await requirePage('tasks', 'contacts');
    const { q } = await searchParams;
    const search = typeof q === 'string' ? q.slice(0, APP_CONFIG.TASKS.MAX_NAME_LENGTH) : '';
    return (
        <FillPage header={<PageHeader icon={Contact} title={page.label} subtitle={page.description} actions={<AgendaSearch />} />}>
            {/* A new name from the search bar starts the list again with it */}
            <ContactsView key={search} initialSearch={search} />
        </FillPage>
    );
}
