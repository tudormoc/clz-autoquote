'use client';

import { ChevronLeft, ChevronRight, Calendar, Users, Settings } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { APP_COPY } from '@/locales';

interface PresenceSidebarProps {
    activeSection: string;
}

const copy = APP_COPY.analytics;

// Nav sections — labels from locale, no hardcoded strings
const PRESENCE_SECTIONS = [
    { id: 'operators',    label: copy.operators.title,    icon: Users },
    { id: 'daily-events', label: copy.dailyEvents.title,  icon: Calendar },
];

export function PresenceSidebar({ activeSection }: PresenceSidebarProps) {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const isSettingsActive = activeSection === 'settings';

    return (
        <aside
            className={`bg-card border-r border-zinc-800 transition-all duration-300 ${
                isCollapsed ? 'w-16' : 'w-64'
            }`}
        >
            <div className="flex flex-col h-full">
                {/* Header */}
                <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                    {!isCollapsed && (
                        <h2 className="text-sm font-semibold text-zinc-400">
                            {copy.presenceSidebar.heading}
                        </h2>
                    )}
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-primary transition-colors"
                        title={isCollapsed ? 'Expand' : 'Collapse'}
                    >
                        {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                    </button>
                </div>

                {/* Sections List */}
                <nav className="flex-1 overflow-y-auto p-2">
                    <div className="space-y-1">
                        {PRESENCE_SECTIONS.map((section) => {
                            const Icon = section.icon;
                            const isActive = activeSection === section.id;

                            return (
                                <Link
                                    key={section.id}
                                    href={`/presence/${section.id}`}
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded transition-colors ${
                                        isActive
                                            ? 'bg-primary/10 text-primary'
                                            : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                                    }`}
                                    title={isCollapsed ? section.label : undefined}
                                >
                                    <Icon size={18} className="flex-shrink-0" />
                                    {!isCollapsed && (
                                        <span className="text-sm font-medium truncate">
                                            {section.label}
                                        </span>
                                    )}
                                </Link>
                            );
                        })}
                    </div>
                </nav>

                {/* Bottom Settings Link */}
                <div className="p-2 border-t border-zinc-800 mt-auto">
                    <Link
                        href="/presence/settings"
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded transition-colors ${
                            isSettingsActive
                                ? 'bg-primary/10 text-primary'
                                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                        }`}
                        title={isCollapsed ? copy.presenceSidebar.settings : undefined}
                    >
                        <Settings size={18} className="flex-shrink-0" />
                        {!isCollapsed && (
                            <span className="text-sm font-medium truncate">
                                {copy.presenceSidebar.settings}
                            </span>
                        )}
                    </Link>
                </div>
            </div>
        </aside>
    );
}
