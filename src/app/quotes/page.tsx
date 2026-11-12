import { FileText } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { AdvancedQuoteForm } from '@/components/quote/AdvancedQuoteForm';
import { getNavArea } from '@/config/navigation';
import { APP_COPY } from '@/locales';
import { requirePage } from '@/lib/auth/access';

export const metadata = { title: getNavArea('quotes').label };

export default async function QuotesPage() {
    await requirePage('quotes');
    return (
        <>
            <PageHeader icon={FileText} title={APP_COPY.quotes.title} />
            <AdvancedQuoteForm />
        </>
    );
}
