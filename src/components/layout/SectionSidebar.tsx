'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SECTION_NAVS, type NavItem, type SectionNavId } from '@/config/navigation';
import { APP_COPY } from '@/locales';
import { cn } from '@/lib/utils';

/**
 * Collapsible sidebar of a section (analytics, presence …), built from SECTION_NAVS.
 * Rendered from the section's layout.tsx, so it stays mounted while moving between its pages.
 */
export function SectionSidebar({ nav }: { nav: SectionNavId }) {
    const { title, groups, footer } = SECTION_NAVS[nav];
    const pathname = usePathname();
    const [isCollapsed, setIsCollapsed] = useState(false);

    const renderItem = (item: NavItem) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
            <Link
                key={item.id}
                href={item.href}
                className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 rounded transition-colors',
                    isActive ? 'bg-primary/10 text-primary' : 'text-fg-muted hover:bg-muted hover:text-fg-soft'
                )}
                title={isCollapsed ? item.label : undefined}
            >
                <Icon size={18} className="flex-shrink-0" />
                {!isCollapsed && <span className="text-sm font-medium truncate">{item.label}</span>}
            </Link>
        );
    };

    return (
        <aside className={cn('bg-card border-r border-border transition-all duration-300', isCollapsed ? 'w-sidebar-collapsed' : 'w-sidebar')}>
            <div className="flex flex-col h-full">
                <div className="p-4 border-b border-border flex items-center justify-between">
                    {!isCollapsed && <h2 className="text-sm font-semibold text-fg-muted">{title}</h2>}
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="p-1 hover:bg-muted rounded text-fg-muted hover:text-primary transition-colors"
                        title={isCollapsed ? APP_COPY.common.expand : APP_COPY.common.collapse}
                    >
                        {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                    </button>
                </div>

                <nav className="flex-1 overflow-y-auto p-2">
                    {groups.map((group, index) => (
                        <div key={group.label ?? index} className="mb-4">
                            {group.label && !isCollapsed && (
                                <div className="px-3 py-2 text-xs font-semibold text-fg-subtle">{group.label}</div>
                            )}
                            <div className="space-y-1">{group.items.map(renderItem)}</div>
                        </div>
                    ))}
                </nav>

                {footer && footer.length > 0 && (
                    <div className="p-2 border-t border-border mt-auto">{footer.map(renderItem)}</div>
                )}
            </div>
        </aside>
    );
}
