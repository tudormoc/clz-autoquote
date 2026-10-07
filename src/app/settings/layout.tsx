import { AppShell } from '@/components/layout/AppShell';
import { SectionSidebar } from '@/components/layout/SectionSidebar';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
    return <AppShell sidebar={<SectionSidebar nav="settings" />}>{children}</AppShell>;
}
