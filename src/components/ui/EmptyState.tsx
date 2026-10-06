import { cn } from '@/lib/utils';

interface EmptyStateProps {
    title: React.ReactNode;
    description?: React.ReactNode;
    className?: string;
}

/** Centred placeholder panel: section landing pages, "nothing selected yet", no results. */
export function EmptyState({ title, description, className }: EmptyStateProps) {
    return (
        <div className={cn('bg-card border border-border rounded-lg p-8 text-center', className)}>
            <p className="text-fg-secondary text-lg mb-2">{title}</p>
            {description && <p className="text-fg-subtle text-sm">{description}</p>}
        </div>
    );
}
