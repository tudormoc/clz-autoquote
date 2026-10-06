import { AppShell } from '@/components/layout/AppShell';
import { SectionSidebar } from '@/components/layout/SectionSidebar';

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
    return <AppShell sidebar={<SectionSidebar nav="analytics" />}>{children}</AppShell>;
}
