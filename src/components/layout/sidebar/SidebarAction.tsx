import type { LucideIcon } from '@/components/ui/icons';
import { SidebarFlyout } from '@/components/layout/sidebar/SidebarFlyout';
import { SIDEBAR_ACTION_ROW } from '@/components/layout/sidebar/sidebarRow';
import { MenuRow } from '@/components/ui/MenuRow';

interface SidebarActionProps {
    icon: LucideIcon;
    label: string;
    onClick: () => void;
}

/** A button row at the foot of the sidebar (Cambia PIN, Esci); folded, only the icon with its name on hover. */
export function SidebarAction({ icon: Icon, label, onClick }: SidebarActionProps) {
    return (
        <div className="group/item relative">
            <MenuRow onClick={onClick} aria-label={label} className={SIDEBAR_ACTION_ROW}>
                <Icon size={18} className="shrink-0" />
                <span className="truncate collapsed:hidden">{label}</span>
            </MenuRow>
            <SidebarFlyout align="bottom">
                <p className="px-2 py-1 text-sm text-fg">{label}</p>
            </SidebarFlyout>
        </div>
    );
}
