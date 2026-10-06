import Link from 'next/link';
import { FileText, Settings } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { AdvancedQuoteForm } from '@/components/quote/AdvancedQuoteForm';
import { buttonClasses } from '@/components/ui/Button';
import { APP_COPY } from '@/locales';

export default function QuotesPage() {
    return (
        <AppShell>
            <PageHeader
                icon={FileText}
                title={APP_COPY.quotes.title}
                subtitle={APP_COPY.quotes.subtitle}
                actions={
                    <Link href="/settings" className={buttonClasses({ variant: 'outline' })}>
                        <Settings size={18} />
                        {APP_COPY.quotes.settings}
                    </Link>
                }
            />
            <AdvancedQuoteForm />
        </AppShell>
    );
}
