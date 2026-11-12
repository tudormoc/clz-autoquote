import { cn } from '@/lib/utils';
import { Surface } from '@/components/ui/Surface';

interface SidebarFlyoutProps {
    /** Line the panel up with the top of its row, or with its bottom (rows low on the screen) */
    align: 'top' | 'bottom';
    children: React.ReactNode;
}

/**
 * Panel beside an icon of the folded sidebar, shown while its row is hovered or has keyboard focus (name, and the area's pages).
 * The row around it is a `relative group/item`. Hidden while the sidebar is open: the row shows all of it there.
 */
export function SidebarFlyout({ align, children }: SidebarFlyoutProps) {
    return (
        <div
            className={cn(
                'hidden collapsed:group-hover/item:block collapsed:group-has-[:focus-visible]/item:block absolute left-full z-50 pl-2',
                align === 'top' ? 'top-0' : 'bottom-0'
            )}
        >
            <Surface kind="floating" className="min-w-52 p-1.5">{children}</Surface>
        </div>
    );
}
