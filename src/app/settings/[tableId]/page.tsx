import { notFound } from 'next/navigation';
import { MANAGER_COMPONENTS } from '@/components/admin/managerComponents';
import { PageHeader } from '@/components/layout/PageHeader';
import { ADMIN_TABLES, getAdminTable } from '@/config/adminTables';

interface SettingsTablePageProps {
    params: Promise<{ tableId: string }>;
}

export default async function SettingsTablePage({ params }: SettingsTablePageProps) {
    const { tableId } = await params;
    const table = getAdminTable(tableId);
    const Manager = MANAGER_COMPONENTS[tableId];

    if (!table || !Manager) notFound();

    return (
        <>
            <PageHeader icon={table.icon} title={table.label} subtitle={table.description} />
            <Manager />
        </>
    );
}

// Pre-render every settings page at build time
export function generateStaticParams() {
    return ADMIN_TABLES.map((table) => ({ tableId: table.id }));
}
