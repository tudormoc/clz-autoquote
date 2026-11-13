'use client';

import { PanelLeftClose, PanelLeftOpen } from '@/components/ui/icons';
import { SidebarFlyout } from '@/components/layout/sidebar/SidebarFlyout';
import { SIDEBAR_ACTION_ROW } from '@/components/layout/sidebar/sidebarRow';
import { toggleSidebarCollapsed } from '@/lib/sidebar';
import { APP_COPY } from '@/locales';
import { MenuRow } from '@/components/ui/MenuRow';

const copy = APP_COPY.nav;

/** Folds the desktop sidebar to icons and opens it again; the choice is remembered (src/lib/sidebar.ts). */
export function SidebarFoldButton() {
    return (
        <div className="group/item relative">
            <MenuRow onClick={toggleSidebarCollapsed} className={SIDEBAR_ACTION_ROW}>
                <PanelLeftClose size={18} className="shrink-0 collapsed:hidden" />
                <PanelLeftOpen size={18} className="shrink-0 hidden collapsed:block" />
                <span className="collapsed:hidden">{copy.collapse}</span>
                <span className="hidden collapsed:inline collapsed:sr-only">{copy.expand}</span>
            </MenuRow>
            <SidebarFlyout align="bottom">
                <p className="px-2 py-1 text-sm text-fg">{copy.expand}</p>
            </SidebarFlyout>
        </div>
    );
}
