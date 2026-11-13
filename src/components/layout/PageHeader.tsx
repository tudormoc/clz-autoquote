import type { LucideIcon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { titleClasses } from '@/components/ui/titleLook';

interface PageHeaderProps {
    title: string;
    icon?: LucideIcon;
    subtitle?: React.ReactNode;
    /** Controls aligned to the right of the title (filters, refresh, export …) */
    actions?: React.ReactNode;
}

/**
 * Title row at the top of every page: icon and title, controls on the right.
 * On phones the top bar already names the page, so only the controls remain (the title stays for screen readers).
 */
export function PageHeader({ title, icon: Icon, subtitle, actions }: PageHeaderProps) {
    return (
        <div className={cn('mb-4 lg:mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-3', !actions && 'max-lg:mb-0')}>
            <div className="min-w-0 max-lg:sr-only">
                <div className="flex items-center gap-2.5">
                    {Icon && <Icon className="shrink-0 text-primary" size={20} />}
                    <h1 className={titleClasses('page', 'truncate')}>{title}</h1>
                </div>
                {subtitle && <div className="mt-0.5 text-sm text-fg-muted">{subtitle}</div>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2 sm:gap-3">{actions}</div>}
        </div>
    );
}
