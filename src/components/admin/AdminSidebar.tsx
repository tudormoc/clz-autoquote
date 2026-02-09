'use client';

import React from 'react';
import { ADMIN_TABLES, getTablesByCategory } from '@/config/adminTables';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { APP_COPY } from '@/locales/en';

interface AdminSidebarProps {
    activeTable: string;
    onTableSelect: (tableId: string) => void;
    isCollapsed: boolean;
    onToggleCollapse: () => void;
}

export function AdminSidebar({ 
    activeTable, 
    onTableSelect, 
    isCollapsed, 
    onToggleCollapse 
}: AdminSidebarProps) {
    const tablesByCategory = getTablesByCategory();
    const categoryLabels = APP_COPY.admin.categories;

    return (
        <aside 
            className={`
                bg-white border-r border-gray-200 
                transition-all duration-300 ease-in-out
                ${isCollapsed ? 'w-16' : 'w-64'}
                flex flex-col
            `}
        >
            {/* Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                {!isCollapsed && (
                    <h2 className="font-semibold text-gray-900">
                        {APP_COPY.admin.sidebar.title}
                    </h2>
                )}
                <button
                    onClick={onToggleCollapse}
                    className="p-1.5 hover:bg-gray-100 rounded-md transition-colors ml-auto"
                    aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    {isCollapsed ? (
                        <ChevronRight size={20} className="text-gray-600" />
                    ) : (
                        <ChevronLeft size={20} className="text-gray-600" />
                    )}
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto p-2">
                {Object.entries(tablesByCategory).map(([category, tables]) => (
                    <div key={category} className="mb-4">
                        {!isCollapsed && (
                            <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                {categoryLabels[category as keyof typeof categoryLabels] || category}
                            </div>
                        )}
                        <div className="space-y-1">
                            {tables.map(table => {
                                const Icon = table.icon;
                                const isActive = activeTable === table.id;
                                
                                return (
                                    <button
                                        key={table.id}
                                        onClick={() => onTableSelect(table.id)}
                                        className={`
                                            w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                                            transition-all duration-150
                                            ${isActive 
                                                ? 'bg-blue-50 text-blue-700 font-medium' 
                                                : 'text-gray-700 hover:bg-gray-50'
                                            }
                                            ${isCollapsed ? 'justify-center' : ''}
                                        `}
                                        title={isCollapsed ? table.label : undefined}
                                    >
                                        <Icon 
                                            size={20} 
                                            className={isActive ? 'text-blue-600' : 'text-gray-500'}
                                        />
                                        {!isCollapsed && (
                                            <span className="text-sm">{table.label}</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>
        </aside>
    );
}
