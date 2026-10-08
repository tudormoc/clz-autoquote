import { FileText } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { AdvancedQuoteForm } from '@/components/quote/AdvancedQuoteForm';
import { getNavArea } from '@/config/navigation';
import { APP_COPY } from '@/locales';

export const metadata = { title: getNavArea('quotes').label };

export default function QuotesPage() {
    return (
        <>
            <PageHeader icon={FileText} title={APP_COPY.quotes.title} subtitle={APP_COPY.quotes.subtitle} />
            <AdvancedQuoteForm />
        </>
    );
}
