'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useState } from 'react';
import { Menu } from 'lucide-react';
import { useAccess } from '@/components/auth/AccessProvider';
import { MobileMenu } from '@/components/layout/MobileMenu';
import { Sidebar } from '@/components/layout/sidebar/Sidebar';
import { FRAMELESS_ROUTES, findNavLocation, isWithin } from '@/config/navigation';
import { APP_COPY } from '@/locales';
import { surfaceClasses } from '@/components/ui/Surface';
import { IconButton } from '@/components/ui/IconButton';

/**
 * Frame of every page, rendered once by the root layout so the sidebar stays put while moving around the app.
 * Desktop (lg and up): sidebar on the left, the content scrolls on its own. Smaller screens: a top bar with the
 * page name and a menu button that slides the sidebar in; the page scrolls as a whole.
 * A page that fills the height (work progress) uses `h-full`. Without a login (the login page) there is no frame.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [menuOpen, setMenuOpen] = useState(false);
    const closeMenu = useCallback(() => setMenuOpen(false), []);

    const access = useAccess();

    if (!access || FRAMELESS_ROUTES.some((route) => isWithin(pathname, route))) return children;

    const { area, page } = findNavLocation(pathname);

    return (
        <div className="min-h-dvh lg:h-dvh lg:flex lg:overflow-hidden bg-background">
            <aside className={surfaceClasses('chrome', 'hidden lg:block shrink-0 w-sidebar collapsed:w-sidebar-collapsed border-r transition-[width] duration-slide')}>
                <Sidebar />
            </aside>
            <MobileMenu open={menuOpen} onClose={closeMenu} />

            <div className="flex-1 min-w-0 flex flex-col lg:min-h-0">
                <header className={surfaceClasses('chrome', 'lg:hidden sticky top-0 z-30 h-14 shrink-0 flex items-center gap-1 px-2 border-b bg-card/95 backdrop-blur')}>
                    <IconButton size="lg"
                        type="button"
                        onClick={() => setMenuOpen(true)}
                        aria-label={APP_COPY.nav.openMenu}
                        aria-expanded={menuOpen}
                        className="p-2.5 rounded-md hover:text-fg"
                    >
                        <Menu size={22} />
                    </IconButton>
                    <span className="truncate font-semibold text-fg-strong">{page?.label ?? area?.label ?? APP_COPY.header.title}</span>
                </header>
                <main className="flex-1 lg:min-h-0 lg:overflow-y-auto p-4 lg:p-6">{children}</main>
            </div>
        </div>
    );
}
