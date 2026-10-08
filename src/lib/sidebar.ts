/**
 * Desktop sidebar folded to icons or not. The state lives on <html data-sidebar="collapsed"> (styled through the
 * `collapsed:` Tailwind variant, see tailwind.config.js) and is remembered in this browser's localStorage.
 */

const STORAGE_KEY = 'clz:sidebar';
const COLLAPSED = 'collapsed';

/** Runs in <head> before the first paint (src/app/layout.tsx), so a folded sidebar never flashes open on reload */
export const SIDEBAR_BOOT_SCRIPT =
    `try{if(localStorage.getItem('${STORAGE_KEY}')==='${COLLAPSED}')document.documentElement.dataset.sidebar='${COLLAPSED}'}catch(e){}`;

export function toggleSidebarCollapsed(): void {
    const root = document.documentElement;
    const collapse = root.dataset.sidebar !== COLLAPSED;
    if (collapse) root.dataset.sidebar = COLLAPSED;
    else delete root.dataset.sidebar;
    try {
        localStorage.setItem(STORAGE_KEY, collapse ? COLLAPSED : 'expanded');
    } catch {
        // Storage blocked (private window): the choice lasts until the page is reloaded
    }
}
