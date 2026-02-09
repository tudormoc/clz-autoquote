'use client';

import { useState } from 'react';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { ADMIN_TABLES, MANAGER_COMPONENTS } from '@/config/adminTables';
import { ShieldCheck } from 'lucide-react';
import { APP_COPY } from '@/locales/en';

export default function AdminDashboard() {
    const [activeTable, setActiveTable] = useState(ADMIN_TABLES[0].id);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    const activeTableConfig = ADMIN_TABLES.find(t => t.id === activeTable);
    const ManagerComponent = MANAGER_COMPONENTS[activeTable];

    return (
        <div className="flex h-[calc(100vh-64px)]">
            {/* Sidebar */}
            <AdminSidebar
                activeTable={activeTable}
                onTableSelect={setActiveTable}
                isCollapsed={sidebarCollapsed}
                onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            />

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto bg-gray-50">
                <div className="max-w-7xl mx-auto px-6 py-8">
                    {/* Header */}
                    <div className="mb-8">
                        <div className="flex items-center gap-3 mb-2">
                            <ShieldCheck className="text-blue-600" size={28} />
                            <h1 className="text-2xl font-bold text-gray-900">
                                {APP_COPY.admin.title}
                            </h1>
                        </div>
                        {activeTableConfig && (
                            <div className="flex items-center gap-2 text-gray-600">
                                <span className="text-sm font-medium">{activeTableConfig.label}</span>
                                {activeTableConfig.description && (
                                    <>
                                        <span className="text-gray-400">•</span>
                                        <span className="text-sm text-gray-500">
                                            {activeTableConfig.description}
                                        </span>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Active Manager Component */}
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {ManagerComponent ? <ManagerComponent /> : (
                            <div className="text-center py-12 text-gray-500">
                                {APP_COPY.admin.noManager}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
