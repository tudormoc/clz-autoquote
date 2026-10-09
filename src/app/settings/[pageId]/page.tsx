import { notFound } from 'next/navigation';
import { SETTINGS_COMPONENTS } from '@/components/admin/settingsComponents';
import { PageHeader } from '@/components/layout/PageHeader';
import { getSettingsPage } from '@/config/settingsPages';
import { requirePage } from '@/lib/auth/access';

interface SettingsEntryPageProps {
    params: Promise<{ pageId: string }>;
}

export default async function SettingsEntryPage({ params }: SettingsEntryPageProps) {
    const { pageId } = await params;
    await requirePage('settings', pageId);
    const page = getSettingsPage(pageId);
    const Settings = SETTINGS_COMPONENTS[pageId];

    if (!page || !Settings) notFound();

    return (
        <>
            <PageHeader icon={page.icon} title={page.label} subtitle={page.description} />
            <Settings />
        </>
    );
}

export async function generateMetadata({ params }: SettingsEntryPageProps) {
    const { pageId } = await params;
    return { title: getSettingsPage(pageId)?.label };
}
