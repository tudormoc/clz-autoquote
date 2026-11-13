import type { LucideIcon } from '@/components/ui/icons';
import { surfaceClasses } from '@/components/ui/Surface';
import { titleClasses } from '@/components/ui/titleLook';

interface PanelProps {
    title: React.ReactNode;
    icon?: LucideIcon;
    /** Shown on the right of the title: an amount, a button */
    aside?: React.ReactNode;
    className?: string;
    children: React.ReactNode;
}

/**
 * A panel with its title: a block of a form or of a page (Cosa, Quando, Come si fa …), a part of a settings page, a
 * section of the quote. The one titled panel of the app; a box without a title is a Surface.
 */
export function Panel({ title, icon: Icon, aside, className, children }: PanelProps) {
    const heading = (
        <h2 className={titleClasses('section', 'flex items-center gap-2')}>
            {Icon && <Icon size={16} className="text-primary" />}
            {title}
        </h2>
    );
    return (
        <section className={surfaceClasses('panel', 'p-4 sm:p-5 space-y-4', className)}>
            {aside ? (
                <div className="flex items-center justify-between gap-3">
                    {heading}
                    {aside}
                </div>
            ) : (
                heading
            )}
            {children}
        </section>
    );
}
