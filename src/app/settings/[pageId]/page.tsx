import { notFound } from 'next/navigation';
import { SETTINGS_COMPONENTS } from '@/components/admin/settingsComponents';
import { PageHeader } from '@/components/layout/PageHeader';
import { SETTINGS_PAGES, getSettingsPage } from '@/config/settingsPages';

interface SettingsEntryPageProps {
    params: Promise<{ pageId: string }>;
}

export default async function SettingsEntryPage({ params }: SettingsEntryPageProps) {
    const { pageId } = await params;
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

// Pre-render every settings page at build time
export function generateStaticParams() {
    return SETTINGS_PAGES.map((page) => ({ pageId: page.id }));
}
