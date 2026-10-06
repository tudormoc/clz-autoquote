import { AppShell } from '@/components/layout/AppShell';
import { SectionSidebar } from '@/components/layout/SectionSidebar';

export default function PresenceLayout({ children }: { children: React.ReactNode }) {
    return <AppShell sidebar={<SectionSidebar nav="presence" />}>{children}</AppShell>;
}
