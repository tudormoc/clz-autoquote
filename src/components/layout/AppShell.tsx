import { Header } from '@/components/layout/Header';
import { cn } from '@/lib/utils';

type AppShellLayout = 'page' | 'workspace' | 'bare';

interface AppShellProps {
    children: React.ReactNode;
    /** Section sidebar shown left of the content (see SectionSidebar) */
    sidebar?: React.ReactNode;
    /**
     * page      — scrolling content in a centred column (default)
     * workspace — full-height area, the content manages its own scrolling
     * bare      — children fill the area with no padding (they bring their own layout)
     */
    layout?: AppShellLayout;
}

/** Frame of every page: header on top, optional sidebar, then the content area. */
export function AppShell({ children, sidebar, layout = 'page' }: AppShellProps) {
    return (
        <div className="h-screen flex flex-col bg-background overflow-hidden">
            <Header />
            <div className="flex-1 flex overflow-hidden">
                {sidebar}
                <main className={cn('flex-1 bg-background', layout === 'workspace' ? 'min-h-0 flex flex-col' : 'overflow-y-auto')}>
                    {layout === 'page' && <div className="max-w-page mx-auto px-6 py-6">{children}</div>}
                    {layout === 'workspace' && (
                        <div className="flex-1 min-h-0 w-full max-w-workspace mx-auto px-4 py-3 flex flex-col">{children}</div>
                    )}
                    {layout === 'bare' && children}
                </main>
            </div>
        </div>
    );
}
