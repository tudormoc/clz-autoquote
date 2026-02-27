'use client';

import { ANALYTICS_SECTIONS, getSectionsByCategory } from '@/config/analyticsSections';
import { APP_COPY } from '@/locales/en';
import { ChevronLeft, ChevronRight, Home } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

interface AnalyticsSidebarProps {
    activeSection: string;
}

export function AnalyticsSidebar({ activeSection }: AnalyticsSidebarProps) {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const sectionsByCategory = getSectionsByCategory();

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
                        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">
                            {APP_COPY.analytics.sidebar.title}
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
                    {Object.entries(sectionsByCategory).map(([category, sections]) => (
                        <div key={category} className="mb-4">
                            {!isCollapsed && (
                                <div className="px-3 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                                    {APP_COPY.analytics.categories[category as keyof typeof APP_COPY.analytics.categories]}
                                </div>
                            )}
                            <div className="space-y-1">
                                {sections.map((section) => {
                                    const Icon = section.icon;
                                    const isActive = activeSection === section.id;

                                    return (
                                        <Link
                                            key={section.id}
                                            href={`/analytics/${section.id}`}
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
                        </div>
                    ))}
                </nav>
            </div>
        </aside>
    );
}
