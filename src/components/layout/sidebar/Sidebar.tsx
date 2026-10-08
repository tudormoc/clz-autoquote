'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { BookOpen, X } from 'lucide-react';
import { SidebarArea } from '@/components/layout/sidebar/SidebarArea';
import { SidebarFoldButton } from '@/components/layout/sidebar/SidebarFoldButton';
import { NAV_AREAS, isWithin, type NavArea, type NavAreaId } from '@/config/navigation';
import { APP_COPY } from '@/locales';

interface SidebarProps {
    /** Phone menu: closes it (its close button, and after following a link). Without it: the desktop sidebar. */
    onClose?: () => void;
}

/** The app's menu, built from NAV_AREAS: brand, the work areas with their pages, settings at the bottom. */
export function Sidebar({ onClose }: SidebarProps) {
    const pathname = usePathname();
    // Areas opened or closed with their arrow; the others list their pages while the current page is in them
    const [openedByHand, setOpenedByHand] = useState<Partial<Record<NavAreaId, boolean>>>({});
    const isOpen = (area: NavArea) => openedByHand[area.id] ?? isWithin(pathname, area.href);

    const renderArea = (area: NavArea) => (
        <SidebarArea
            key={area.id}
            area={area}
            pathname={pathname}
            open={isOpen(area)}
            onToggle={() => setOpenedByHand((current) => ({ ...current, [area.id]: !isOpen(area) }))}
            onNavigate={onClose}
            flyoutAlign={area.pinnedBottom ? 'bottom' : 'top'}
        />
    );

    return (
        <div className="h-full flex flex-col">
            <div className="h-14 shrink-0 flex items-center gap-2 px-3 collapsed:justify-center collapsed:px-0 border-b border-border">
                <Link href="/" onClick={onClose} className="flex items-center gap-3 min-w-0 rounded-md">
                    <span className="shrink-0 p-1.5 rounded bg-primary text-primary-foreground">
                        <BookOpen size={18} strokeWidth={2.5} />
                    </span>
                    <span className="font-bold text-lg tracking-tight text-fg-strong truncate collapsed:hidden">{APP_COPY.header.title}</span>
                </Link>
                {onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={APP_COPY.nav.closeMenu}
                        className="ml-auto p-2 rounded-md text-fg-muted hover:text-fg hover:bg-muted transition-colors"
                    >
                        <X size={20} />
                    </button>
                )}
            </div>

            <nav className="flex-1 min-h-0 flex flex-col p-2 overflow-y-auto overscroll-contain collapsed:overflow-visible">
                <div className="space-y-0.5">{NAV_AREAS.filter((area) => !area.pinnedBottom).map(renderArea)}</div>
                <div className="mt-auto pt-2 space-y-0.5">
                    <div className="border-t border-border mb-2" />
                    {NAV_AREAS.filter((area) => area.pinnedBottom).map(renderArea)}
                </div>
            </nav>

            {!onClose && (
                <div className="shrink-0 p-2 border-t border-border">
                    <SidebarFoldButton />
                </div>
            )}
        </div>
    );
}
