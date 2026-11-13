import Link from 'next/link';
import { SidebarFlyout } from '@/components/layout/sidebar/SidebarFlyout';
import { SidebarPages } from '@/components/layout/sidebar/SidebarPages';
import { SIDEBAR_ROW } from '@/components/layout/sidebar/sidebarRow';
import { isWithin, type NavArea } from '@/config/navigation';
import { APP_COPY, fmt } from '@/locales';
import { cn } from '@/lib/utils';
import { IconButton } from '@/components/ui/IconButton';
import { ROW_PICKED } from '@/components/ui/MenuRow';
import { FoldArrow } from '@/components/ui/FoldArrow';

interface SidebarAreaProps {
    area: NavArea;
    pathname: string;
    /** Its pages are listed under it (open sidebar) */
    open: boolean;
    onToggle: () => void;
    onNavigate?: () => void;
    /** Where the folded sidebar's panel lines up with the row */
    flyoutAlign: 'top' | 'bottom';
}

/**
 * One area of the sidebar: its name links to the area (overview page or single page), the arrow shows or hides its
 * pages. Folded sidebar: only the icon, and a panel with the name and the pages while it is hovered.
 */
export function SidebarArea({ area, pathname, open, onToggle, onNavigate, flyoutAlign }: SidebarAreaProps) {
    const { icon: Icon, label, groups } = area;
    const inArea = isWithin(pathname, area.href);
    const onAreaPage = pathname === area.href;

    return (
        <div className="group/item relative">
            <div
                className={cn(
                    'flex items-center rounded-md transition-colors',
                    onAreaPage ? ROW_PICKED : 'hover:bg-muted',
                    !onAreaPage && (inArea ? 'text-fg-strong' : 'text-fg-muted hover:text-fg')
                )}
            >
                <Link
                    href={area.href}
                    onClick={onNavigate}
                    aria-label={label}
                    aria-current={onAreaPage ? 'page' : undefined}
                    className={cn(SIDEBAR_ROW, 'flex-1 min-w-0')}
                >
                    <Icon size={18} className={cn('shrink-0', inArea && 'text-primary')} />
                    <span className="truncate collapsed:hidden">{label}</span>
                </Link>
                {groups && (
                    <IconButton
                        type="button"
                        onClick={onToggle}
                        aria-expanded={open}
                        aria-label={fmt(APP_COPY.nav.showPages, { area: label })}
                        className="collapsed:hidden shrink-0 mr-1 text-fg-subtle hover:text-fg hover:bg-muted-strong"
                    >
                        <FoldArrow open={open} />
                    </IconButton>
                )}
            </div>

            {groups && open && (
                <div className="collapsed:hidden ml-5 pl-2 mt-0.5 mb-1.5 border-l border-border">
                    <SidebarPages groups={groups} pathname={pathname} onNavigate={onNavigate} />
                </div>
            )}

            <SidebarFlyout align={flyoutAlign}>
                <Link href={area.href} className="block px-2 py-1.5 text-sm font-semibold text-fg-strong hover:text-primary transition-colors">
                    {label}
                </Link>
                {groups && <SidebarPages groups={groups} pathname={pathname} />}
            </SidebarFlyout>
        </div>
    );
}
