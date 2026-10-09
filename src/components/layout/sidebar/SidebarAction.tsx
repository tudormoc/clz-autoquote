import type { LucideIcon } from 'lucide-react';
import { SidebarFlyout } from '@/components/layout/sidebar/SidebarFlyout';
import { SIDEBAR_ROW } from '@/components/layout/sidebar/sidebarRow';
import { cn } from '@/lib/utils';

interface SidebarActionProps {
    icon: LucideIcon;
    label: string;
    onClick: () => void;
}

/** A button row at the foot of the sidebar (Cambia PIN, Esci); folded, only the icon with its name on hover. */
export function SidebarAction({ icon: Icon, label, onClick }: SidebarActionProps) {
    return (
        <div className="group/item relative">
            <button type="button" onClick={onClick} aria-label={label} className={cn(SIDEBAR_ROW, 'w-full text-fg-muted hover:bg-muted hover:text-fg transition-colors')}>
                <Icon size={18} className="shrink-0" />
                <span className="truncate collapsed:hidden">{label}</span>
            </button>
            <SidebarFlyout align="bottom">
                <p className="px-2 py-1 text-sm text-fg">{label}</p>
            </SidebarFlyout>
        </div>
    );
}
