import { Contact } from 'lucide-react';
import { FillPage } from '@/components/layout/FillPage';
import { PageHeader } from '@/components/layout/PageHeader';
import { ContactsView } from '@/components/tasks/contacts/ContactsView';
import { AgendaSearch } from '@/components/tasks/shared/AgendaSearch';
import { requirePage } from '@/lib/auth/access';
import { APP_COPY } from '@/locales';

const page = APP_COPY.tasks.pages.contacts;

export const metadata = { title: page.label };

export default async function ContactsPage() {
    await requirePage('tasks', 'contacts');
    return (
        <FillPage header={<PageHeader icon={Contact} title={page.label} subtitle={page.description} actions={<AgendaSearch />} />}>
            <ContactsView />
        </FillPage>
    );
}
