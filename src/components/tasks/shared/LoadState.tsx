import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { APP_COPY } from '@/locales';

/** What an Agenda page shows before its data is there: a spinner, or why it could not load */
export function LoadState({ loading, error }: { loading: boolean; error: string | null }) {
    if (error) return <EmptyState title={APP_COPY.common.loadError} description={error} />;
    if (!loading) return null;
    return (
        <div className="flex justify-center py-12">
            <Spinner size={24} className="text-primary" />
        </div>
    );
}
