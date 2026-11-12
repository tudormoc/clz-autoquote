import { surfaceClasses } from '@/components/ui/Surface';

interface EmptyStateProps {
    title: React.ReactNode;
    description?: React.ReactNode;
    className?: string;
    /** Action under the text (a link or button) */
    children?: React.ReactNode;
}

/** Centred placeholder panel: "nothing selected yet", no results, page not found. */
export function EmptyState({ title, description, className, children }: EmptyStateProps) {
    return (
        <div className={surfaceClasses('panel', 'p-8 text-center', className)}>
            <p className="text-fg-secondary text-lg mb-2">{title}</p>
            {description && <p className="text-fg-subtle text-sm">{description}</p>}
            {children}
        </div>
    );
}
