import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { APP_COPY } from '@/locales';

interface LoadStateProps {
    loading: boolean;
    /** Why the data could not load (shown instead of the spinner) */
    error?: string | null;
}

/** What a screen shows before its data is there: a spinner, or why it could not load; nothing once loaded. */
export function LoadState({ loading, error = null }: LoadStateProps) {
    if (error) return <EmptyState title={APP_COPY.common.loadError} description={error} />;
    if (!loading) return null;
    return (
        <div className="flex justify-center py-12">
            <Spinner size={24} className="text-primary" />
        </div>
    );
}
