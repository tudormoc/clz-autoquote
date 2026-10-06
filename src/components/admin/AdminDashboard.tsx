'use client';

import { useState } from 'react';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { ADMIN_TABLES, MANAGER_COMPONENTS } from '@/config/adminTables';
import { ShieldCheck } from 'lucide-react';
import { APP_COPY } from '@/locales';
import { PageHeader } from '@/components/layout/PageHeader';

export default function AdminDashboard() {
    const [activeTable, setActiveTable] = useState(ADMIN_TABLES[0].id);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    const activeTableConfig = ADMIN_TABLES.find(t => t.id === activeTable);
    const ManagerComponent = MANAGER_COMPONENTS[activeTable];

    return (
        <div className="flex h-full">
            {/* Sidebar */}
            <AdminSidebar
                activeTable={activeTable}
                onTableSelect={setActiveTable}
                isCollapsed={sidebarCollapsed}
                onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            />

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto bg-background">
                <div className="max-w-page mx-auto px-6 py-6">
                    <PageHeader
                        icon={ShieldCheck}
                        title={APP_COPY.admin.title}
                        subtitle={activeTableConfig && (
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{activeTableConfig.label}</span>
                                {activeTableConfig.description && (
                                    <>
                                        <span className="text-fg-faint">•</span>
                                        <span className="text-sm text-fg-subtle">{activeTableConfig.description}</span>
                                    </>
                                )}
                            </div>
                        )}
                    />

                    {/* Active Manager Component */}
                    <div>
                        {ManagerComponent ? <ManagerComponent /> : (
                            <div className="text-center py-12 text-fg-subtle">
                                {APP_COPY.admin.noManager}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
