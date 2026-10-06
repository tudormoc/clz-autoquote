import { Settings } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { PresenceSettingsManager } from '@/components/presence/PresenceSettingsManager';
import { APP_COPY } from '@/locales';

export default function PresenceSettingsPage() {
    const copy = APP_COPY.analytics.presenceSettings;

    return (
        <>
            <PageHeader icon={Settings} title={copy.title} subtitle={copy.subtitle} />
            <PresenceSettingsManager />
        </>
    );
}
