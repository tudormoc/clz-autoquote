import { Users } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { APP_COPY } from '@/locales';

export default function PresencePage() {
    const card = APP_COPY.home.cards.presence;

    return (
        <>
            <PageHeader icon={Users} title={card.title} subtitle={card.description} />
            <EmptyState
                title={`${APP_COPY.analytics.presenceSidebar.heading}: ${card.title}`}
                description={card.description}
            />
        </>
    );
}
