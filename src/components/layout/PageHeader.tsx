import type { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
    title: string;
    icon?: LucideIcon;
    subtitle?: React.ReactNode;
    /** Controls aligned to the right of the title (filters, refresh, export …) */
    actions?: React.ReactNode;
}

/** Title block at the top of every page. */
export function PageHeader({ title, icon: Icon, subtitle, actions }: PageHeaderProps) {
    return (
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
                <div className="flex items-center gap-3 mb-2">
                    {Icon && <Icon className="text-primary" size={24} />}
                    <h1 className="text-2xl font-bold text-fg-strong">{title}</h1>
                </div>
                {subtitle && <div className="text-fg-muted">{subtitle}</div>}
            </div>
            {actions && <div className="flex items-center gap-3">{actions}</div>}
        </div>
    );
}
